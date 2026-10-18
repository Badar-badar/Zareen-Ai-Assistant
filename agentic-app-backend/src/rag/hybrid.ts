import { queryTerms } from "./text.js";

export interface Candidate {
  id: string;
  text: string;
  metadata: any;
  distance: number | null; // vector distance, lower = closer
  keywordScore?: number | null;
}
export type Ranked = Candidate & { rrf: number };

// Reciprocal rank fusion: items ranked high in either list rise, items in both rise most
export function rrf(lists: Candidate[][], k = 60): Ranked[] {
  const merged = new Map<string, Ranked>();
  for (const list of lists) {
    list.forEach((c, i) => {
      const add = 1 / (k + i + 1);
      const prev = merged.get(c.id);
      if (prev) {
        prev.rrf += add;
        prev.distance = prev.distance ?? c.distance;
        prev.keywordScore = prev.keywordScore ?? c.keywordScore;
      } else {
        merged.set(c.id, { ...c, rrf: add });
      }
    });
  }
  return [...merged.values()].sort((a, b) => b.rrf - a.rrf);
}

// Cheap reranker: blends the fused score with how many query terms the chunk contains.
// A real cross-encoder or LLM reranker can replace this later with the same signature.
export function lexicalRerank(query: string, items: Ranked[], topK: number): Ranked[] {
  const terms = queryTerms(query);
  const maxRrf = Math.max(...items.map((i) => i.rrf), 1e-9);
  return items
    .map((it) => {
      const text = it.text.toLowerCase();
      const coverage = terms.length ? terms.filter((t) => text.includes(t)).length / terms.length : 0;
      return { it, score: 0.5 * (it.rrf / maxRrf) + 0.5 * coverage };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((x) => x.it);
}