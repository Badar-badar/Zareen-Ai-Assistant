const STOP = new Set([
  "the","and","for","are","you","your","what","how","can","does","with","this","that","from","have","has",
  "any","our","who","which","when","where","why","did","not","but","its","about","into","out","get","got","per",
]);

// Lowercase words worth searching for (no stop words, no 1-2 letter words)
export function queryTerms(q: string): string[] {
  const words = q.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return [...new Set(words.filter((w) => w.length > 2 && !STOP.has(w)))];
}

// OR query for Postgres to_tsquery. Terms are only [a-z0-9], so it is safe to pass as a parameter.
export function buildTsQuery(q: string): string | null {
  const terms = queryTerms(q);
  return terms.length ? terms.join(" | ") : null;
}

// Exact codes like item-06, KB-MECH-ERG80, ORD-1007: matched literally, not by meaning
export function extractCodes(q: string): string[] {
  return [...new Set(q.match(/\b[A-Za-z0-9]+(?:[-_][A-Za-z0-9]+)+\b/g) ?? [])];
}