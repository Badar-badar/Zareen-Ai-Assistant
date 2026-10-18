import { describe, it, expect } from "vitest";
import { chunkMarkdown } from "../src/rag/chunker.js";
import { buildTsQuery, extractCodes } from "../src/rag/text.js";
import { rrf, lexicalRerank, type Candidate } from "../src/rag/hybrid.js";

const SAMPLE = `# Doc

## A
- one
- two

---

## B
### B1
text b1
`;

describe("Day 7: chunking", () => {
  it("keeps the heading path at the start of every chunk", () => {
    const chunks = chunkMarkdown(SAMPLE);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].text.startsWith("Doc › A\n")).toBe(true);
    expect(chunks[1].text.startsWith("Doc › B › B1\n")).toBe(true);
  });

  it("never exceeds the size limit and loses no lines", () => {
    const lines = Array.from({ length: 60 }, (_, i) => `- line number ${i} with some words`);
    const chunks = chunkMarkdown(`## Big\n${lines.join("\n")}`, { maxChars: 300, overlapChars: 60 });
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(300);
    const all = chunks.map((c) => c.text).join("\n");
    for (const l of lines) expect(all).toContain(l);
  });

  it("drops horizontal rules and keeps bold markers", () => {
    const chunks = chunkMarkdown("## T\n---\nwithin **2 hours**");
    expect(chunks[0].text).toContain("within **2 hours**");
    expect(chunks[0].text).not.toContain("---");
  });
});

describe("Day 7: keyword helpers", () => {
  it("extracts exact codes", () => {
    expect(extractCodes("sku item-06 and KB-MECH-ERG80 please")).toEqual(["item-06", "KB-MECH-ERG80"]);
    expect(extractCodes("how do returns work")).toEqual([]);
  });

  it("builds an OR query and ignores stop words", () => {
    expect(buildTsQuery("monitor warranty years")).toBe("monitor | warranty | years");
    expect(buildTsQuery("what is the")).toBeNull();
  });
});

describe("Day 7: fusion and rerank", () => {
  const c = (id: string, text = id): Candidate => ({ id, text, metadata: {}, distance: null });

  it("ranks an item found by both searches above items found by one", () => {
    const vec = [{ ...c("a"), distance: 0.1 }, { ...c("b"), distance: 0.2 }];
    const kw = [{ ...c("b"), keywordScore: 1.5 }, c("c")];
    const out = rrf([vec, kw]);
    expect(out.map((x) => x.id)).toEqual(["b", "a", "c"]);
    expect(out[0].distance).toBe(0.2);
    expect(out[0].keywordScore).toBe(1.5);
  });

  it("rerank prefers the chunk that contains the query terms", () => {
    const items = rrf([[c("y", "headphones battery"), c("x", "monitor warranty three years")]]);
    const out = lexicalRerank("monitor warranty years", items, 2);
    expect(out[0].id).toBe("x");
  });
});