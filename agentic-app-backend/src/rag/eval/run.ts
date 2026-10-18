import { RagEngine } from "../ragEngine.js";
import { QUESTIONS } from "./questions.js";

const K = 5;
const norm = (s: string) => s.replace(/\s+/g, " ").toLowerCase();
const pct = (n: number, d: number) => `${((n / d) * 100).toFixed(0)}%`;

async function search(q: string) {
  const log = console.log;
  console.log = () => {}; // ragEngine logs a lot; silence it during the run
  try {
    const r = await RagEngine.buildPrompt(q, K);
    return r.sources as { text: string; score: number | null; metadata: any }[];
  } finally {
    console.log = log;
  }
}

async function main() {
  const answerable = QUESTIONS.filter((q) => q.mustContain);
  const noAnswer = QUESTIONS.filter((q) => !q.mustContain);

  let hit1 = 0, hit3 = 0, hit5 = 0, rrSum = 0;
  const bestAnswerable: number[] = [];
  const misses: string[] = [];

  for (const q of answerable) {
    const sources = await search(q.question);
    const want = norm(q.mustContain!);
    const idx = sources.findIndex((s) => norm(s.text).includes(want));
    const rank = idx === -1 ? null : idx + 1;

    if (rank === 1) hit1++;
    if (rank !== null && rank <= 3) hit3++;
    if (rank !== null && rank <= 5) hit5++;
    rrSum += rank ? 1 / rank : 0;
    if (sources[0]?.score != null) bestAnswerable.push(sources[0].score);

    console.log(`#${String(q.id).padStart(2)} [${q.type.padEnd(7)}] rank=${rank ?? "MISS"}  ${q.question}`);
    if (rank === null) {
      misses.push(`#${q.id} wanted "${q.mustContain}"\n    top chunk: ${sources[0]?.text.slice(0, 120).replace(/\s+/g, " ")}...`);
    }
  }

  console.log("\n--- no-answer questions (best distance; lower = closer match) ---");
  const bestNoAnswer: number[] = [];
  for (const q of noAnswer) {
    const sources = await search(q.question);
    const d = sources[0]?.score ?? null;
    if (d != null) bestNoAnswer.push(d);
    console.log(`#${q.id} best distance=${d?.toFixed(4) ?? "n/a"}  ${q.question}`);
  }

  const avg = (a: number[]) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(4) : "n/a");
  const n = answerable.length;

  console.log("\n================ BASELINE ================");
  console.log(`questions scored: ${n}`);
  console.log(`hit@1: ${pct(hit1, n)}   hit@3: ${pct(hit3, n)}   hit@5: ${pct(hit5, n)}`);
  console.log(`MRR:   ${(rrSum / n).toFixed(3)}`);
  console.log(`avg best distance, answerable:  ${avg(bestAnswerable)}`);
  console.log(`avg best distance, no-answer:   ${avg(bestNoAnswer)}`);
  if (misses.length) console.log("\nMISSES:\n" + misses.join("\n"));
  process.exit(0);
}

main().catch((e) => {
  console.error("eval failed:", e);
  process.exit(1);
});