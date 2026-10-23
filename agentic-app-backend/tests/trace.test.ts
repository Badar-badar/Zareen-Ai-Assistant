import { describe, it, expect } from "vitest";
import { Trace, timeline } from "../src/obs/trace.js";

describe("Day 11: tracing", () => {
  it("records timing, and the slow span is visible", async () => {
    const t = new Trace("u1");
    await t.span("model", { step: 1 }, async () => new Promise((r) => setTimeout(r, 10)));
    await t.span("tool:ragSearch", { tool: "ragSearch" }, async () => new Promise((r) => setTimeout(r, 120)));
    const rec = t.finish({ stopReason: "done", inputTokens: 1, outputTokens: 1, costUsd: 0 });
    const slowest = [...rec.spans].sort((a, b) => b.durationMs - a.durationMs)[0];
    expect(slowest.name).toBe("tool:ragSearch");
    expect(timeline(rec)).toContain("tool:ragSearch");
  });

  it("records an error and rethrows", async () => {
    const t = new Trace("u1");
    await expect(t.span("tool:x", {}, async () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(t.finish({ stopReason: "error", inputTokens: 0, outputTokens: 0, costUsd: 0 }).spans[0].error).toBe("boom");
  });
});