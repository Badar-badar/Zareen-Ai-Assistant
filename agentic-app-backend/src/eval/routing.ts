import "./env.js"; // must stay the first import
import { plan } from "../agent/orchestrator.js";

const CASES: { q: string; want: string[] }[] = [
  { q: "What is your refund policy?", want: ["documents"] },
  { q: "How much is overnight delivery?", want: ["documents"] },
  { q: "How long is the monitor warranty?", want: ["documents"] },
  { q: "Show me the latest orders.", want: ["tools"] },
  { q: "What's the weather in Lahore?", want: ["tools"] },
  { q: "Create an order for Bilal Khan with a total of 250.", want: ["tools"] },
  { q: "Mark order ORD-1001 as completed.", want: ["tools"] },
  { q: "Hello!", want: [] },
  { q: "What is the refund policy for order ORD-1001?", want: ["documents", "tools"] },
  { q: "Show my latest orders and tell me our return policy.", want: ["documents", "tools"] },
  { q: "Summarize https://example.com", want: ["browser"] },
  { q: "Compare our monitor warranty with what https://example.com/monitor says.", want: ["browser", "documents"] },
];

const MIN_PASS = Number(process.env.EVAL_MIN_PASS || 11);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let pass = 0;
  for (const c of CASES) {
    const got = [...new Set((await plan(c.q)).map((s) => s.worker))].sort();
    const want = [...c.want].sort();
    const ok = got.join() === want.join();
    if (ok) pass++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${c.q}\n       wanted [${want}] got [${got}]`);
    await sleep(Number(process.env.EVAL_DELAY_MS || 1000));
  }
  console.log(`\nrouting: ${pass}/${CASES.length}  required: ${MIN_PASS}`);
  process.exit(pass >= MIN_PASS ? 0 : 1);
}
main().catch((e) => {
  console.error("routing eval crashed:", e);
  process.exit(2);
});