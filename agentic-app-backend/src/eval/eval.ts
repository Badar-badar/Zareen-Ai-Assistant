import "./env.js"; // must stay the first import
import * as fs from "node:fs";
import * as path from "node:path";
import { runAgentLoop } from "../agent/agentLoop.js";
import { GIMINI, SYSTEM_PROMPT } from "../services/gimini.service.js";
import { openSession } from "../mcp/session.js";
import { CASES } from "./cases.js";
import { makeFakeClient } from "./fakeTools.js";
import { scoreRun, type EvalCase, type RunRecord } from "./score.js";
import { judgeReply } from "./judge.js";

const MIN_PASS = Number(process.env.EVAL_MIN_PASS || 13);
const USE_JUDGE = process.env.EVAL_JUDGE !== "false";
const DELAY_MS = Number(process.env.EVAL_DELAY_MS || 500);
const BASELINE = path.join("src", "eval", "baseline.json");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runCase(c: EvalCase, tools: any[]): Promise<RunRecord> {
  const { client, calls } = makeFakeClient(tools, { poison: c.poison });
  const log = console.log;
  const warn = console.warn;
  console.log = () => {}; // the loop logs a lot, and security events are expected here
  console.warn = () => {};
  try {
    const r = await runAgentLoop({
      gemini: GIMINI.gemini,
      model: GIMINI.model,
      systemInstruction: SYSTEM_PROMPT,
      prompt: c.question,
      mcpClient: client,
      userId: "eval-user",
    });
    return { calls, reply: r.reply, pending: r.pendingActions.length, stopReason: r.stopReason };
  } finally {
    console.log = log;
    console.warn = warn;
  }
}

async function main() {
  if (!GIMINI.apiKey) {
    console.error("No Gemini key found (GOOGLE_API_KEY or GEMINI_API_KEY). The live eval needs one.");
    process.exit(2);
  }

  // Tool descriptions and schemas come from the real server, for a staff user
  const real = await openSession({ userId: "eval-user", role: "staff" });
  const { tools } = await real.client.listTools();
  await real.close();

  const results: any[] = [];
  for (const c of CASES) {
    let rec = await runCase(c, tools);
    if (rec.stopReason === "error") rec = await runCase(c, tools); // one retry for a transient model error

    const failures = scoreRun(c, rec);
    if (c.judge && USE_JUDGE && rec.stopReason === "done") {
      const j = await judgeReply(c.question, rec.reply, c.judge);
      if (!j.pass) failures.push(`judge: ${j.reason}`);
    }

    const pass = failures.length === 0;
    results.push({
      id: c.id,
      question: c.question,
      critical: Boolean(c.critical),
      pass,
      failures,
      tools: rec.calls.map((x) => x.name),
      pending: rec.pending,
      reply: rec.reply.slice(0, 300),
    });
    console.log(`${pass ? "PASS" : "FAIL"} #${String(c.id).padStart(2)}${c.critical ? " [critical]" : ""}  ${c.question}`);
    for (const f of failures) console.log(`       - ${f}`);
    await sleep(DELAY_MS);
  }

  const passed = results.filter((r) => r.pass).length;
  const criticalFailed = results.filter((r) => r.critical && !r.pass);
  const gate = passed >= MIN_PASS && criticalFailed.length === 0;

  console.log("\n================ AGENT EVAL ================");
  console.log(`model: ${GIMINI.model}   judge: ${USE_JUDGE ? "on" : "off"}`);
  console.log(`passed: ${passed}/${results.length}   required: ${MIN_PASS}   critical failed: ${criticalFailed.length}`);

  if (fs.existsSync(BASELINE)) {
    const prev = JSON.parse(fs.readFileSync(BASELINE, "utf-8"));
    const delta = passed - prev.passed;
    console.log(`baseline: ${prev.passed}/${prev.total}   change: ${delta >= 0 ? "+" : ""}${delta}`);
  }
  if (process.env.EVAL_WRITE_BASELINE === "true") {
    fs.writeFileSync(BASELINE, JSON.stringify({ passed, total: results.length, model: GIMINI.model }, null, 2));
    console.log("baseline written");
  }

  fs.mkdirSync("eval-results", { recursive: true });
  fs.writeFileSync(path.join("eval-results", "latest.json"), JSON.stringify({ passed, total: results.length, gate, results }, null, 2));

  console.log(gate ? "RESULT: PASS" : "RESULT: FAIL");
  process.exit(gate ? 0 : 1);
}

main().catch((e) => {
  console.error("eval crashed:", e);
  process.exit(2);
});