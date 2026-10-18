import { describe, it, expect, vi } from "vitest";
import { runAgentLoop } from "../src/agent/agentLoop.js";
import { StreamSanitizer, safeCut } from "../src/guard/stream.js";
import { sanitizeReply } from "../src/guard/output.js";

const base = { model: "m", systemInstruction: "sys", prompt: "hello", userId: "u1" };

function streamGemini(steps: Array<Array<{ text?: string; call?: { name: string; args: any } }>>) {
  const consumed = { n: 0 };
  let i = 0;
  const generateContentStream = vi.fn(async () => {
    const chunks = steps[i++] ?? [];
    return (async function* () {
      for (const c of chunks) {
        consumed.n++;
        yield {
          candidates: [{ content: { role: "model", parts: [c.call ? { functionCall: c.call } : { text: c.text }] } }],
          usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
        };
      }
    })();
  });
  return { gemini: { models: { generateContentStream } } as any, consumed };
}

function mcp(names: string[] = ["getLatestOrders"]) {
  const callTool = vi.fn(async (_r: any) => ({ content: [{ type: "text", text: "ORD-1" }] }));
  const listTools = vi.fn(async () => ({
    tools: names.map((name) => ({ name, description: "", inputSchema: { type: "object", properties: {} } })),
  }));
  return { client: { listTools, callTool } as any, callTool };
}

describe("Day 9: stream sanitizer", () => {
  it("never releases a half-finished link, and ends equal to the full cleaned text", () => {
    const s = new StreamSanitizer();
    const pieces = ["See [our pol", "icy](https://ev", "il.com/p) now ok"];
    const out: string[] = [];
    for (const p of pieces) out.push(s.push(p));
    const f = s.finish();
    out.push(f.delta);
    expect(out.join("")).toBe(sanitizeReply(pieces.join("")).text);
    for (const o of out) expect(o).not.toContain("evil.com");
  });

  it("never releases an image", () => {
    const s = new StreamSanitizer();
    const pieces = ["Hi ![x](https://evil.com/p.png?d=1", ") bye ok"];
    const out = pieces.map((p) => s.push(p));
    out.push(s.finish().delta);
    expect(out.join("")).not.toContain("evil.com");
    expect(out.join("")).not.toContain("![");
  });

  it("holds back an unfinished tag", () => {
    expect(safeCut("hello <scr")).toBe("hello ".length - 0 > 0 ? "hello ".length - 0 : 0);
  });
});

describe("Day 9: streaming loop", () => {
  it("streams the answer piece by piece and returns the same text", async () => {
    const { gemini } = streamGemini([[{ text: "Hello " }, { text: "world" }]]);
    const deltas: string[] = [];
    const r = await runAgentLoop({ ...base, gemini, mcpClient: mcp().client, onDelta: (t) => deltas.push(t) });
    expect(r.stopReason).toBe("done");
    expect(r.reply).toBe("Hello world");
    expect(deltas.join("")).toBe("Hello world");
  });

  it("a tool step sends reset, then the final answer streams", async () => {
    const { gemini } = streamGemini([
      [{ text: "Let me check " }, { call: { name: "getLatestOrders", args: {} } }],
      [{ text: "Done " }, { text: "now" }],
    ]);
    const m = mcp();
    const onReset = vi.fn();
    const deltas: string[] = [];
    const r = await runAgentLoop({ ...base, gemini, mcpClient: m.client, onDelta: (t) => deltas.push(t), onReset });
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(m.callTool).toHaveBeenCalledTimes(1);
    expect(r.reply).toBe("Done now");
  });

  it("DONE-WHEN: cancelling mid-answer stops reading the model and runs no tool", async () => {
    const ac = new AbortController();
    const { gemini, consumed } = streamGemini([[{ text: "one " }, { text: "two " }, { text: "three " }]]);
    const m = mcp();
    const r = await runAgentLoop({
      ...base, gemini, mcpClient: m.client, signal: ac.signal,
      onDelta: () => ac.abort(), // the user presses Stop after the first words
    });
    expect(r.stopReason).toBe("cancelled");
    expect(consumed.n).toBe(1); // the rest of the stream was never read
    expect(m.callTool).not.toHaveBeenCalled();
    expect(r.pendingActions).toHaveLength(0);
  });

  it("an already-cancelled request never calls the model", async () => {
    const ac = new AbortController();
    ac.abort();
    const { gemini } = streamGemini([[{ text: "x" }]]);
    const r = await runAgentLoop({ ...base, gemini, mcpClient: mcp().client, signal: ac.signal, onDelta: () => {} });
    expect(r.stopReason).toBe("cancelled");
    expect(gemini.models.generateContentStream).not.toHaveBeenCalled();
  });
});