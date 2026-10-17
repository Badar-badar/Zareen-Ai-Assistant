import { randomUUID } from "node:crypto";
import type { GoogleGenAI, Content, Part } from "@google/genai";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { AGENT, ALLOWED_TOOLS } from "../config/agent.js";
import type { PendingView } from "../services/pendingAction.service.js";

export type StopReason = "done" | "max_steps" | "timeout" | "budget" | "error";

export interface AgentResult {
  reply: string;
  stopReason: StopReason;
  steps: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  pendingActions: PendingView[];
}

const STOP_MESSAGES: Record<Exclude<StopReason, "done">, string> = {
  max_steps: "I couldn't finish that within my step limit. Please try a simpler or more specific request.",
  timeout: "That took too long and I had to stop. Please try again with a simpler request.",
  budget: "That request used more resources than allowed, so I stopped. Please try a smaller request.",
  error: "Something went wrong while working on that. Please try again.",
};

interface RunOptions {
  gemini: GoogleGenAI;
  model: string;
  systemInstruction: string;
  prompt: string;
  mcpClient: Client;
  userId?: string;
  history?: Content[];
}

export async function runAgentLoop(opts: RunOptions): Promise<AgentResult> {
  const { gemini, model, systemInstruction, prompt, mcpClient, userId, history = [] } = opts;

  const runId = randomUUID().slice(0, 8);
  const startedAt = Date.now();
  const deadline = startedAt + AGENT.totalTimeoutMs;

  const log = (event: string, data: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ at: new Date().toISOString(), runId, userId, event, ...data }));

  let inputTokens = 0;
  let outputTokens = 0;
  const pendingActions: PendingView[] = []; // proposals created during this run
  const costOf = () =>
    (inputTokens / 1e6) * AGENT.priceInputPerMTok + (outputTokens / 1e6) * AGENT.priceOutputPerMTok;

  const finish = (reply: string, stopReason: StopReason, steps: number): AgentResult => {
    const costUsd = Number(costOf().toFixed(6));
    log("run_end", {
      stopReason, steps, inputTokens, outputTokens, costUsd,
      pendingActions: pendingActions.length,
      durationMs: Date.now() - startedAt,
    });
    return { reply, stopReason, steps, inputTokens, outputTokens, costUsd, pendingActions };
  };

  // 1. Tell the model which tools exist. The per-request server already hides tools this user
  //    may not use; ALLOWED_TOOLS is a second filter on top of that.
  const { tools } = await mcpClient.listTools();
  const exposed = tools.filter((t) => ALLOWED_TOOLS.has(t.name));
  const functionDeclarations = exposed.map((t) => {
    const { $schema, ...schema } = t.inputSchema as Record<string, unknown>;
    return { name: t.name, description: t.description ?? t.title ?? "", parametersJsonSchema: schema };
  });
  const allowedNames = new Set(exposed.map((t) => t.name));

  // 2. Run one tool call, with a timeout and a size cap on its result
  const runTool = async (name: string, args: Record<string, unknown>) => {
    if (!allowedNames.has(name)) return { output: `Tool "${name}" is not available.`, isError: true };
    try {
      const timeout = Math.max(1, Math.min(AGENT.toolTimeoutMs, deadline - Date.now()));
      const result: any = await mcpClient.callTool({ name, arguments: args }, undefined, { timeout });

      // Proposals come from the server's saved record, never from the model's text
      const pending = result.structuredContent?.pending;
      if (name.startsWith("propose") && !result.isError && pending?.id && !pendingActions.some((p) => p.id === pending.id)) {
        pendingActions.push(pending as PendingView);
      }

      let text = ((result.content ?? []) as any[])
        .filter((c) => c.type === "text")
        .map((c) => c.text)
        .join("\n");
      if (text.length > AGENT.maxToolResultChars) {
        text = text.slice(0, AGENT.maxToolResultChars) + "\n...[truncated]";
      }
      return { output: text, isError: Boolean(result.isError) };
    } catch (err) {
      return { output: `Tool failed: ${(err as Error).message}`, isError: true };
    }
  };

  // 3. The loop
  const contents: Content[] = [...history, { role: "user", parts: [{ text: prompt }] }];
  log("run_start", {
    promptChars: prompt.length, historyMessages: history.length, maxSteps: AGENT.maxSteps,
    tools: functionDeclarations.map((d) => d.name),
  });

  for (let step = 1; step <= AGENT.maxSteps; step++) {
    if (Date.now() >= deadline) return finish(STOP_MESSAGES.timeout, "timeout", step - 1);
    if (inputTokens + outputTokens >= AGENT.tokenBudget) return finish(STOP_MESSAGES.budget, "budget", step - 1);

    let response;
    try {
      response = await gemini.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations }],
          automaticFunctionCalling: { disable: true },
          abortSignal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
        },
      });
    } catch (err) {
      const e = err as Error;
      if (Date.now() >= deadline || e.name === "AbortError" || e.name === "TimeoutError") {
        return finish(STOP_MESSAGES.timeout, "timeout", step - 1);
      }
      log("model_error", { step, message: e.message });
      return finish(STOP_MESSAGES.error, "error", step - 1);
    }

    const usage = response.usageMetadata;
    const stepIn = usage?.promptTokenCount ?? 0;
    const stepOut = (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
    inputTokens += stepIn;
    outputTokens += stepOut;

    const calls = response.functionCalls ?? [];
    log("step", {
      step, stepIn, stepOut,
      totalTokens: inputTokens + outputTokens,
      runningCostUsd: Number(costOf().toFixed(6)),
      toolCalls: calls.map((c) => c.name),
    });

    if (calls.length === 0) {
      const text = (response.text ?? "").trim();
      if (!text) return finish(STOP_MESSAGES.error, "error", step);
      return finish(text, "done", step);
    }

    const modelContent = response.candidates?.[0]?.content;
    if (!modelContent) return finish(STOP_MESSAGES.error, "error", step);
    contents.push(modelContent);

    const resultParts: Part[] = [];
    for (let i = 0; i < calls.length; i++) {
      const call = calls[i];
      const name = call.name ?? "";
      let out: { output: string; isError: boolean };

      if (i >= AGENT.maxToolCallsPerStep) {
        out = { output: "Too many tool calls in one step. Ask for fewer.", isError: true };
      } else {
        out = await runTool(name, (call.args ?? {}) as Record<string, unknown>);
      }

      log("tool", { step, name, isError: out.isError, resultChars: out.output.length });
      resultParts.push({
        functionResponse: {
          name,
          ...(call.id ? { id: call.id } : {}),
          response: out.isError ? { error: out.output } : { output: out.output },
        },
      });
    }
    contents.push({ role: "user", parts: resultParts });
  }

  return finish(STOP_MESSAGES.max_steps, "max_steps", AGENT.maxSteps);
}