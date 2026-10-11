import { randomUUID } from "node:crypto";
import type { GoogleGenAI, Content, Part } from "@google/genai";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { AGENT, ALLOWED_TOOLS } from "../config/agent.js";

export type StopReason = "done" | "max_steps" | "timeout" | "budget" | "error";

export interface AgentResult {
  reply: string;
  stopReason: StopReason;
  steps: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
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

  // Structured logs. The prompt text is never logged (only its length): it may contain personal data.
  const log = (event: string, data: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ at: new Date().toISOString(), runId, userId, event, ...data }));

  let inputTokens = 0;
  let outputTokens = 0;
  const costOf = () =>
    (inputTokens / 1e6) * AGENT.priceInputPerMTok + (outputTokens / 1e6) * AGENT.priceOutputPerMTok;

  const finish = (reply: string, stopReason: StopReason, steps: number): AgentResult => {
    const costUsd = Number(costOf().toFixed(6));
    log("run_end", {
      stopReason, steps, inputTokens, outputTokens, costUsd,
      durationMs: Date.now() - startedAt,
    });
    return { reply, stopReason, steps, inputTokens, outputTokens, costUsd };
  };

  // 1. Tell the model which tools exist
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
  log("run_start", { promptChars: prompt.length, maxSteps: AGENT.maxSteps, tools: [...allowedNames] });

  for (let step = 1; step <= AGENT.maxSteps; step++) {
    if (Date.now() >= deadline) return finish(STOP_MESSAGES.timeout, "timeout", step - 1);
    if (inputTokens + outputTokens >= AGENT.tokenBudget) return finish(STOP_MESSAGES.budget, "budget", step - 1);

    // 3a. Call the model (automatic tool-running is switched off: this loop does it)
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

    // 3b. Count tokens and cost for this step
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

    // 3c. No tool requested: the model is finished
    if (calls.length === 0) {
      const text = (response.text ?? "").trim();
      if (!text) return finish(STOP_MESSAGES.error, "error", step);
      return finish(text, "done", step);
    }

    // 3d. Keep the model's reply in the history exactly as returned
    const modelContent = response.candidates?.[0]?.content;
    if (!modelContent) return finish(STOP_MESSAGES.error, "error", step);
    contents.push(modelContent);

    // 3e. Run the requested tools and send every result back
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

  // The cap was hit while the model still wanted to call tools
  return finish(STOP_MESSAGES.max_steps, "max_steps", AGENT.maxSteps);
}