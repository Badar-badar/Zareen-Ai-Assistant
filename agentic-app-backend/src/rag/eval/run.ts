import { RagEngine, type RagMode } from "../ragEngine.js";
import { QUESTIONS } from "./questions.js";

const K = 5;
const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase();
const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(0)}%`;

async function evaluate(mode: RagMode) {
  const answerable = QUESTIONS.filter((q) => q.mustContain);
  const noAnswer = QUESTIONS.filter((q) => !q.mustContain);
  let hit1 = 0, hit3 = 0, hit5 = 0, rr = 0;
  const bestA: number[] = [];
  const bestN: number[] = [];
  const misses: string[] = [];

  for (const q of answerable) {
    const r = await RagEngine.retrieve(q.question, { topK: K, mode, rerank: false });
    const want = norm(q.mustContain!);
    const idx = r.chunks.findIndex((c) => norm(c.text).includes(want));
    const rank = idx === -1 ? null : idx + 1;
    if (rank === 1) hit1++;
    if (rank !== null && rank <= 3) hit3++;
    if (rank !== null && rank <= 5) hit5++;
    rr += rank ? 1 / rank : 0;
    if (r.bestDistance !== null) bestA.push(r.bestDistance);
    if (rank === null) misses.push(`#${q.id} wanted "${q.mustContain}"`);
  }
  for (const q of noAnswer) {
    const r = await RagEngine.retrieve(q.question, { topK: K, mode, rerank: false });
    if (r.bestDistance !== null) bestN.push(r.bestDistance);
  }
  return { mode, n: answerable.length, hit1, hit3, hit5, mrr: rr / answerable.length, bestA, bestN, misses };
}

async function main() {
  const results = [await evaluate("vector"), await evaluate("hybrid")];

  console.log("\nmode     hit@1  hit@3  hit@5  MRR");
  for (const r of results) {
    console.log(`${r.mode.padEnd(8)} ${pct(r.hit1, r.n).padEnd(6)} ${pct(r.hit3, r.n).padEnd(6)} ${pct(r.hit5, r.n).padEnd(6)} ${r.mrr.toFixed(3)}`);
  }

  const v = results[0];
  const maxA = Math.max(...v.bestA);
  const minN = Math.min(...v.bestN);
  console.log(`\nbest vector distance: answerable max=${maxA.toFixed(4)}, no-answer min=${minN.toFixed(4)}`);
  console.log(
    maxA < minN
      ? `Suggested RAG_MAX_DISTANCE=${((maxA + minN) / 2).toFixed(3)}`
      : "Distances overlap: a threshold cannot separate them yet."
  );
  for (const r of results) if (r.misses.length) console.log(`\nMISSES (${r.mode}):\n` + r.misses.join("\n"));
  process.exit(0);
}

main().catch((e) => {
  console.error("eval failed:", e);
  process.exit(1);
});