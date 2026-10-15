import { vi } from "vitest";

// A scripted stand-in for Gemini. Each call to generateContent returns the next scripted reply.
// When the script runs out, the LAST reply repeats (so "loop forever" is one entry).
export type FakeReply =
  | { calls: { name: string; args?: Record<string, unknown> }[]; tokensIn?: number; tokensOut?: number }
  | { text: string; tokensIn?: number; tokensOut?: number };

export function fakeGemini(script: FakeReply[], opts: { delayMs?: number } = {}) {
  let i = 0;
  const generateContent = vi.fn(async (req: any) => {
    if (opts.delayMs) {
      await new Promise((r, rej) => {
        const t = setTimeout(r, opts.delayMs);
        req?.config?.abortSignal?.addEventListener("abort", () => { clearTimeout(t); rej(Object.assign(new Error("aborted"), { name: "AbortError" })); });
      });
    }
    const step = script[Math.min(i++, script.length - 1)];
    const usageMetadata = { promptTokenCount: step.tokensIn ?? 10, candidatesTokenCount: step.tokensOut ?? 5 };
    if ("calls" in step) {
      const parts = step.calls.map((c, n) => ({ functionCall: { name: c.name, args: c.args ?? {}, id: `c${i}-${n}` } }));
      return {
        usageMetadata,
        functionCalls: parts.map((p) => p.functionCall),
        candidates: [{ content: { role: "model", parts } }],
        text: undefined,
      };
    }
    return { usageMetadata, functionCalls: undefined, candidates: [{ content: { role: "model", parts: [{ text: step.text }] } }], text: step.text };
  });
  return { gemini: { models: { generateContent } } as any, generateContent };
}

// A stand-in for the MCP tool client.
export function fakeMcp(toolNames: string[], handler?: (name: string, args: any) => string) {
  const callTool = vi.fn(async (req: { name: string; arguments: any }) => ({
    content: [{ type: "text", text: handler ? handler(req.name, req.arguments) : `result of ${req.name}` }],
  }));
  const listTools = vi.fn(async () => ({
    tools: toolNames.map((name) => ({ name, description: name, inputSchema: { type: "object", properties: {} } })),
  }));
  return { client: { listTools, callTool } as any, callTool, listTools };
}