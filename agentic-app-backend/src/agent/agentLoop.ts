import { randomUUID } from "node:crypto";
import type { GoogleGenAI, Content, Part, FunctionCall } from "@google/genai";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { AGENT, ALLOWED_TOOLS } from "../config/agent.js";
import type { PendingView } from "../services/pendingAction.service.js";
import { wrapUntrusted } from "../guard/untrusted.js";
import { detectInjection } from "../guard/detect.js";
import { sanitizeReply } from "../guard/output.js";
import { securityLog } from "../guard/log.js";
import { StreamSanitizer } from "../guard/stream.js";
import { Trace } from "../obs/trace.js";
import { saveTrace } from "../obs/store.js";
import { exportToOtel } from "../obs/otel.js";
export type StopReason = "done" | "max_steps" | "timeout" | "budget" | "error" | "cancelled";

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
  cancelled: "Stopped.",
};

interface RunOptions {
  gemini: GoogleGenAI;
  model: string;
  systemInstruction: string;
  prompt: string;
  mcpClient: Client;
  userId?: string;
  history?: Content[];
  // Streaming (all optional). Without onDelta the loop works exactly as before.
  signal?: AbortSignal;
  onDelta?: (text: string) => void;
  onReset?: () => void; // the text streamed so far belonged to a tool step; clear it
  onReplace?: (text: string) => void; // final cleaned text differs from what was streamed
}

type Usage = { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };

export async function runAgentLoop(opts: RunOptions): Promise<AgentResult> {
  const { gemini, model, systemInstruction, prompt, mcpClient, userId, history = [], signal, onDelta, onReset, onReplace } = opts;

  const runId = randomUUID().slice(0, 8);
  const startedAt = Date.now();
    const tr = new Trace(userId ?? "anonymous");
  const deadline = startedAt + AGENT.totalTimeoutMs;

  const log = (event: string, data: Record<string, unknown> = {}) =>
    console.log(JSON.stringify({ at: new Date().toISOString(), runId, userId, event, ...data }));

  let inputTokens = 0;
  let outputTokens = 0;
  const pendingActions: PendingView[] = [];
  const costOf = () =>
    (inputTokens / 1e6) * AGENT.priceInputPerMTok + (outputTokens / 1e6) * AGENT.priceOutputPerMTok;

  const finish = (reply: string, stopReason: StopReason, steps: number): AgentResult => {
    const costUsd = Number(costOf().toFixed(6));
    log("run_end", {
      stopReason, steps, inputTokens, outputTokens, costUsd,
      pendingActions: pendingActions.length,
      durationMs: Date.now() - startedAt,
    });
    const rec = tr.finish({ stopReason, inputTokens, outputTokens, costUsd });
    void saveTrace(rec);
    exportToOtel(rec);
    return { reply, stopReason, steps, inputTokens, outputTokens, costUsd, pendingActions };
  };

  const aborted = () => Boolean(signal?.aborted);

  // 1. Tools the model may see (the per-request server already hides what this user may not use)
  const { tools } = await mcpClient.listTools();
  const exposed = tools.filter((t) => ALLOWED_TOOLS.has(t.name));
  const functionDeclarations = exposed.map((t) => {
    const { $schema, ...schema } = t.inputSchema as Record<string, unknown>;
    return { name: t.name, description: t.description ?? t.title ?? "", parametersJsonSchema: schema };
  });
  const allowedNames = new Set(exposed.map((t) => t.name));

  // 2. Run one tool call, with a timeout, cancellation and a size cap on its result
  const runTool = async (name: string, args: Record<string, unknown>) => {
    if (!allowedNames.has(name)) {
      securityLog("tool_call_blocked", { runId, userId, tool: name, reason: "not_available" });
      return { output: `Tool "${name}" is not available.`, isError: true };
    }
    try {
      const timeout = Math.max(1, Math.min(AGENT.toolTimeoutMs, deadline - Date.now()));
      const result: any = await tr.span(`tool:${name}`, { tool: name }, () =>
        mcpClient.callTool({ name, arguments: args }, undefined, { timeout, signal })
      );

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
      const found = detectInjection(text);
      if (found.risk !== "none") {
        securityLog("tool_result_flagged", { runId, userId, tool: name, risk: found.risk, matches: found.matches });
      }
      return { output: wrapUntrusted(name, text), isError: Boolean(result.isError) };
    } catch (err) {
      return { output: `Tool failed: ${(err as Error).message}`, isError: true };
    }
  };

  // 2b. One model call. Streams when onDelta is given; otherwise one request, as before.
  const callModelInner = async (contents: Content[]) => {
    const timeoutSignal = AbortSignal.timeout(Math.max(1, deadline - Date.now()));
    const config = {
      systemInstruction,
      tools: [{ functionDeclarations }],
      automaticFunctionCalling: { disable: true },
      abortSignal: signal ? AbortSignal.any([timeoutSignal, signal]) : timeoutSignal,
    };

    if (!onDelta) {
      const response = await gemini.models.generateContent({ model, contents, config });
      const calls = response.functionCalls ?? [];
      return {
        text: calls.length ? "" : (response.text ?? ""),
        calls,
        modelContent: response.candidates?.[0]?.content,
        usage: response.usageMetadata as Usage | undefined,
        sanitizer: undefined as StreamSanitizer | undefined,
      };
    }

    const sanitizer = new StreamSanitizer();
    const parts: Part[] = [];
    const calls: FunctionCall[] = [];
    let text = "";
    let usage: Usage | undefined;

    const stream = await gemini.models.generateContentStream({ model, contents, config });
    for await (const chunk of stream) {
      if (aborted()) throw Object.assign(new Error("aborted"), { name: "AbortError" });
      for (const p of chunk.candidates?.[0]?.content?.parts ?? []) {
        parts.push(p);
        if (p.functionCall) calls.push(p.functionCall);
        else if (p.text && !p.thought) {
          text += p.text;
          const out = sanitizer.push(p.text);
          if (out) onDelta(out);
        }
      }
      if (chunk.usageMetadata) usage = chunk.usageMetadata as Usage;
    }
    return { text, calls, modelContent: { role: "model", parts } as Content, usage, sanitizer };
  };

    let stepNo = 0;
  const callModel = (contents: Content[]) =>
    tr.span("model", { step: ++stepNo, model, streaming: Boolean(onDelta) }, async (set) => {
      const out = await callModelInner(contents);
      set({ inTok: out.usage?.promptTokenCount ?? 0, outTok: out.usage?.candidatesTokenCount ?? 0, toolCalls: out.calls.length });
      return out;
    });
  // 3. The loop
  const inputCheck = detectInjection(prompt);
  if (inputCheck.risk !== "none") {
    securityLog("user_input_flagged", { runId, userId, risk: inputCheck.risk, matches: inputCheck.matches });
  }

  const contents: Content[] = [...history, { role: "user", parts: [{ text: prompt }] }];
  log("run_start", {
    promptChars: prompt.length, historyMessages: history.length, maxSteps: AGENT.maxSteps,
    streaming: Boolean(onDelta),
    tools: functionDeclarations.map((d) => d.name),
  });

  for (let step = 1; step <= AGENT.maxSteps; step++) {
    if (aborted()) return finish("", "cancelled", step - 1);
    if (Date.now() >= deadline) return finish(STOP_MESSAGES.timeout, "timeout", step - 1);
    if (inputTokens + outputTokens >= AGENT.tokenBudget) return finish(STOP_MESSAGES.budget, "budget", step - 1);

    let out;
    try {
      out = await callModel(contents);
    } catch (err) {
      const e = err as Error;
      if (aborted()) return finish("", "cancelled", step - 1);
      if (Date.now() >= deadline || e.name === "AbortError" || e.name === "TimeoutError") {
        return finish(STOP_MESSAGES.timeout, "timeout", step - 1);
      }
      log("model_error", { step, message: e.message });
      return finish(STOP_MESSAGES.error, "error", step - 1);
    }

    const stepIn = out.usage?.promptTokenCount ?? 0;
    const stepOut = (out.usage?.candidatesTokenCount ?? 0) + (out.usage?.thoughtsTokenCount ?? 0);
    inputTokens += stepIn;
    outputTokens += stepOut;

    const calls = out.calls;
    log("step", {
      step, stepIn, stepOut,
      totalTokens: inputTokens + outputTokens,
      runningCostUsd: Number(costOf().toFixed(6)),
      toolCalls: calls.map((c) => c.name),
    });

    if (calls.length === 0) {
      const text = out.text.trim();
      if (!text) return finish(STOP_MESSAGES.error, "error", step);
      const clean = sanitizeReply(text);
      if (clean.removed.length) securityLog("output_stripped", { runId, userId, removed: clean.removed });
      if (!clean.text) return finish(STOP_MESSAGES.error, "error", step);

      if (out.sanitizer && onDelta) {
        const f = out.sanitizer.finish();
        if (f.replace !== undefined) onReplace?.(f.replace);
        else if (f.delta) onDelta(f.delta);
      }
      return finish(clean.text, "done", step);
    }

    onReset?.(); // any text streamed in this step was a preamble to tool calls

    const modelContent = out.modelContent;
    if (!modelContent) return finish(STOP_MESSAGES.error, "error", step);
    contents.push(modelContent);

    const resultParts: Part[] = [];
    for (let i = 0; i < calls.length; i++) {
      if (aborted()) return finish("", "cancelled", step);
      const call = calls[i];
      const name = call.name ?? "";
      let result: { output: string; isError: boolean };

      if (i >= AGENT.maxToolCallsPerStep) {
        result = { output: "Too many tool calls in one step. Ask for fewer.", isError: true };
      } else {
        result = await runTool(name, (call.args ?? {}) as Record<string, unknown>);
      }

      log("tool", { step, name, isError: result.isError, resultChars: result.output.length });
      resultParts.push({
        functionResponse: {
          name,
          ...(call.id ? { id: call.id } : {}),
          response: result.isError ? { error: result.output } : { output: result.output },
        },
      });
    }
    contents.push({ role: "user", parts: resultParts });
  }

  return finish(STOP_MESSAGES.max_steps, "max_steps", AGENT.maxSteps);
}