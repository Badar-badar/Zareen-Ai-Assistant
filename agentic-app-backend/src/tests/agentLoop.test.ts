import { describe, it, expect, vi, beforeEach } from "vitest";
import { fakeGemini, fakeMcp } from "./helpers/fakes.js";

// Make the limits editable inside tests
vi.mock("../src/config/agent.js", () => ({
  AGENT: {
    maxSteps: 4,
    totalTimeoutMs: 5_000,
    toolTimeoutMs: 1_000,
    tokenBudget: 100_000,
    maxToolCallsPerStep: 2,
    maxToolResultChars: 50,
    priceInputPerMTok: 1,
    priceOutputPerMTok: 2,
  },
  ALLOWED_TOOLS: new Set(["getLatestOrders", "getCustomers"]),
}));

// The propose tools need a database, so the loop is tested with a stand-in
vi.mock("../src/agent/proposeTools.js", async (orig) => {
  const actual = await orig<typeof import("../src/agent/proposeTools.js")>();
  return {
    ...actual,
    runProposeTool: vi.fn(async () => ({
      output: "Saved as a PENDING proposal",
      isError: false,
      pending: { id: "a".repeat(24), type: "createOrder", summary: "Create order", expiresAt: new Date().toISOString() },
    })),
  };
});

import { AGENT } from "../src/config/agent.js";
import { runAgentLoop } from "../src/agent/agentLoop.js";
import { runProposeTool } from "../src/agent/proposeTools.js";

const base = { model: "m", systemInstruction: "sys", prompt: "hello", userId: "u1" };
const LOOP_FOREVER = [{ calls: [{ name: "getLatestOrders", args: { limit: 1 } }] }];

beforeEach(() => {
  AGENT.maxSteps = 4;
  AGENT.totalTimeoutMs = 5_000;
  AGENT.tokenBudget = 100_000;
  AGENT.maxToolCallsPerStep = 2;
  AGENT.maxToolResultChars = 50;
  vi.mocked(runProposeTool).mockClear();
});

describe("Day 2: the loop always stops", () => {
  it("answers directly when no tool is needed", async () => {
    const { gemini, generateContent } = fakeGemini([{ text: "Hi there" }]);
    const r = await runAgentLoop({ ...base, gemini, mcpClient: fakeMcp(["getLatestOrders"]).client });
    expect(r.stopReason).toBe("done");
    expect(r.reply).toBe("Hi there");
    expect(r.steps).toBe(1);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("runs a tool, feeds the result back, then answers", async () => {
    const { gemini, generateContent } = fakeGemini([
      { calls: [{ name: "getLatestOrders", args: { limit: 2 } }] },
      { text: "Done" },
    ]);
    const mcp = fakeMcp(["getLatestOrders"]);
    const r = await runAgentLoop({ ...base, gemini, mcpClient: mcp.client });
    expect(r.stopReason).toBe("done");
    expect(r.steps).toBe(2);
    expect(mcp.callTool).toHaveBeenCalledTimes(1);
    // the second model call must contain the tool result
    const secondCall = generateContent.mock.calls[1][0];
    const last = secondCall.contents.at(-1);
    expect(last.parts[0].functionResponse.name).toBe("getLatestOrders");
  });

  it("DONE-WHEN: a prompt that loops forever stops at the step limit", async () => {
    const { gemini, generateContent } = fakeGemini(LOOP_FOREVER);
    const mcp = fakeMcp(["getLatestOrders"]);
    const r = await runAgentLoop({ ...base, gemini, mcpClient: mcp.client });
    expect(r.stopReason).toBe("max_steps");
    expect(r.steps).toBe(4);
    expect(generateContent).toHaveBeenCalledTimes(4); // exactly the cap, never more
    expect(r.reply).toMatch(/step limit/i);
  });

  it("respects a different step cap", async () => {
    AGENT.maxSteps = 2;
    const { gemini, generateContent } = fakeGemini(LOOP_FOREVER);
    const r = await runAgentLoop({ ...base, gemini, mcpClient: fakeMcp(["getLatestOrders"]).client });
    expect(r.stopReason).toBe("max_steps");
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("stops when the token budget is used up", async () => {
    AGENT.tokenBudget = 150;
    const { gemini, generateContent } = fakeGemini([{ calls: [{ name: "getLatestOrders" }], tokensIn: 100, tokensOut: 10 }]);
    const r = await runAgentLoop({ ...base, gemini, mcpClient: fakeMcp(["getLatestOrders"]).client });
    expect(r.stopReason).toBe("budget");
    expect(generateContent).toHaveBeenCalledTimes(2); // 110 after step 1, 220 after step 2 -> stop
  });

  it("stops at the total timeout when the model is slow", async () => {
    AGENT.totalTimeoutMs = 80;
    const { gemini } = fakeGemini([{ text: "late" }], { delayMs: 1_000 });
    const t0 = Date.now();
    const r = await runAgentLoop({ ...base, gemini, mcpClient: fakeMcp(["getLatestOrders"]).client });
    expect(r.stopReason).toBe("timeout");
    expect(Date.now() - t0).toBeLessThan(900); // did not wait the full second
  });

  it("returns a clean 'error' stop when the model call fails", async () => {
    const gemini = { models: { generateContent: vi.fn().mockRejectedValue(new Error("boom")) } } as any;
    const r = await runAgentLoop({ ...base, gemini, mcpClient: fakeMcp(["getLatestOrders"]).client });
    expect(r.stopReason).toBe("error");
    expect(r.reply).not.toMatch(/boom/); // internal error text never reaches the user
  });

  it("counts tokens and cost across steps", async () => {
    const { gemini } = fakeGemini([
      { calls: [{ name: "getLatestOrders" }], tokensIn: 1_000_000, tokensOut: 0 },
      { text: "ok", tokensIn: 0, tokensOut: 1_000_000 },
    ]);
    AGENT.tokenBudget = 10_000_000;
    const r = await runAgentLoop({ ...base, gemini, mcpClient: fakeMcp(["getLatestOrders"]).client });
    expect(r.inputTokens).toBe(1_000_000);
    expect(r.outputTokens).toBe(1_000_000);
    expect(r.costUsd).toBeCloseTo(1 + 2, 6); // $1 per M in, $2 per M out
  });
});

describe("Day 2: tool safety inside the loop", () => {
  it("refuses a tool that is not on the allow-list and never runs it", async () => {
    const { gemini, generateContent } = fakeGemini([
      { calls: [{ name: "deleteEverything" }] },
      { text: "sorry" },
    ]);
    const mcp = fakeMcp(["getLatestOrders", "deleteEverything"]);
    await runAgentLoop({ ...base, gemini, mcpClient: mcp.client });
    expect(mcp.callTool).not.toHaveBeenCalled();
    const fed = generateContent.mock.calls[1][0].contents.at(-1).parts[0].functionResponse.response;
    expect(fed.error).toMatch(/not available/);
  });

  it("does not even show the model tools outside the allow-list", async () => {
    const { gemini, generateContent } = fakeGemini([{ text: "hi" }]);
    await runAgentLoop({ ...base, gemini, mcpClient: fakeMcp(["getLatestOrders", "createOrder"]).client });
    const names = generateContent.mock.calls[0][0].config.tools[0].functionDeclarations.map((d: any) => d.name);
    expect(names).toContain("getLatestOrders");
    expect(names).not.toContain("createOrder");
  });

  it("runs only maxToolCallsPerStep tools in one step", async () => {
    const { gemini } = fakeGemini([
      { calls: Array.from({ length: 5 }, () => ({ name: "getLatestOrders" })) },
      { text: "ok" },
    ]);
    const mcp = fakeMcp(["getLatestOrders"]);
    await runAgentLoop({ ...base, gemini, mcpClient: mcp.client });
    expect(mcp.callTool).toHaveBeenCalledTimes(2);
  });

  it("truncates a huge tool result before sending it to the model", async () => {
    const { gemini, generateContent } = fakeGemini([{ calls: [{ name: "getLatestOrders" }] }, { text: "ok" }]);
    const mcp = fakeMcp(["getLatestOrders"], () => "x".repeat(10_000));
    await runAgentLoop({ ...base, gemini, mcpClient: mcp.client });
    const out = generateContent.mock.calls[1][0].contents.at(-1).parts[0].functionResponse.response.output as string;
    expect(out.length).toBeLessThan(100);
    expect(out).toMatch(/truncated/);
  });

  it("tells the model when a tool throws, and keeps going", async () => {
    const { gemini } = fakeGemini([{ calls: [{ name: "getLatestOrders" }] }, { text: "recovered" }]);
    const mcp = fakeMcp(["getLatestOrders"]);
    mcp.callTool.mockRejectedValueOnce(new Error("db down"));
    const r = await runAgentLoop({ ...base, gemini, mcpClient: mcp.client });
    expect(r.stopReason).toBe("done");
    expect(r.reply).toBe("recovered");
  });
});

describe("Day 3: history", () => {
  it("puts earlier messages before the new one", async () => {
    const { gemini, generateContent } = fakeGemini([{ text: "ok" }]);
    const history = [
      { role: "user", parts: [{ text: "show orders" }] },
      { role: "model", parts: [{ text: "ORD-1 $5" }] },
    ];
    await runAgentLoop({ ...base, prompt: "which is biggest?", gemini, mcpClient: fakeMcp([]).client, history });
    const contents = generateContent.mock.calls[0][0].contents;
    expect(contents).toHaveLength(3);
    expect(contents[1].parts[0].text).toBe("ORD-1 $5");
    expect(contents[2].parts[0].text).toBe("which is biggest?");
  });
});

describe("Day 4: the agent can only propose", () => {
  it("collects proposals and tells the model nothing was created", async () => {
    const { gemini } = fakeGemini([
      { calls: [{ name: "proposeCreateOrder", args: { customerId: "a".repeat(24), totalAmount: 5 } }] },
      { text: "Waiting for your confirmation" },
    ]);
    const mcp = fakeMcp(["getLatestOrders"]);
    const r = await runAgentLoop({ ...base, gemini, mcpClient: mcp.client });
    expect(r.pendingActions).toHaveLength(1);
    expect(runProposeTool).toHaveBeenCalledWith("u1", "proposeCreateOrder", expect.any(Object));
    expect(mcp.callTool).not.toHaveBeenCalled(); // the propose tool never goes through MCP
  });

  it("never offers the propose tools when the user is unknown", async () => {
    const { gemini, generateContent } = fakeGemini([{ text: "hi" }]);
    await runAgentLoop({ ...base, userId: undefined, gemini, mcpClient: fakeMcp(["getLatestOrders"]).client });
    const names = generateContent.mock.calls[0][0].config.tools[0].functionDeclarations.map((d: any) => d.name);
    expect(names).not.toContain("proposeCreateOrder");
  });

  it("refuses a propose call when there is no user", async () => {
    const { gemini } = fakeGemini([{ calls: [{ name: "proposeCreateOrder", args: {} }] }, { text: "x" }]);
    const r = await runAgentLoop({ ...base, userId: undefined, gemini, mcpClient: fakeMcp([]).client });
    expect(runProposeTool).not.toHaveBeenCalled();
    expect(r.pendingActions).toHaveLength(0);
  });

  it("does not list the same proposal twice", async () => {
    const { gemini } = fakeGemini([
      { calls: [{ name: "proposeCreateOrder", args: {} }, { name: "proposeCreateOrder", args: {} }] },
      { text: "ok" },
    ]);
    const r = await runAgentLoop({ ...base, gemini, mcpClient: fakeMcp([]).client });
    expect(r.pendingActions).toHaveLength(1);
  });
});