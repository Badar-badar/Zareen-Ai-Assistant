import { VectorStore } from "./vectorStore/vector.store.js";
import { GIMINI } from "../services/gimini.service.js";
import { rrf, lexicalRerank, type Candidate } from "./hybrid.js";

export type RagMode = "vector" | "hybrid";

export interface RetrievedChunk {
    n: number;
    id: string;
    text: string;
    source: string;
    section: string;
    distance: number | null;
}

export interface RetrievalResult {
    chunks: RetrievedChunk[];
    confident: boolean; // false = nothing relevant enough, the caller should say "I don't know"
    bestDistance: number | null;
    mode: RagMode;
}

const envNum = (name: string, fallback: number) => {
    const v = Number(process.env[name]);
    return Number.isFinite(v) && v >= 0 ? v : fallback;
};

export class RagEngine {
    static async retrieve(
        query: string,
        opts: { topK?: number; mode?: RagMode; rerank?: boolean } = {}
    ): Promise<RetrievalResult> {
        const topK = opts.topK ?? 4;
        const wantHybrid = (opts.mode ?? (process.env.RAG_MODE === "vector" ? "vector" : "hybrid")) === "hybrid";
        const rerank = opts.rerank ?? process.env.RAG_RERANK === "true";
        const poolSize = Math.max(topK * 4, 20); // fetch more candidates than we keep

        const Store: any = VectorStore.get();
        await Store.init();

        const [queryEmbedding] = await GIMINI.generateEmbeddings(query, "RETRIEVAL_QUERY");
        if (!queryEmbedding?.length) throw new Error("failed to create embeddings");
        const expected = Number(process.env.EMBEDDING_DIMS);
        if (expected && queryEmbedding.length !== expected) {
            throw new Error(`Embedding dimension mismatch: expected ${expected} but got ${queryEmbedding.length}`);
        }

        const vec: Candidate[] = (await Store.search(queryEmbedding, poolSize)).map((r: any) => ({
            id: r.id, text: r.text, metadata: r.metadata ?? {}, distance: r.score ?? null,
        }));

        let kw: Candidate[] = [];
        let mode: RagMode = "vector";
        if (wantHybrid && typeof Store.keywordSearch === "function") {
            mode = "hybrid";
            kw = (await Store.keywordSearch(query, poolSize)).map((r: any) => ({
                id: r.id, text: r.text, metadata: r.metadata ?? {}, distance: null, keywordScore: r.score,
            }));
        }

        const fused = rrf(mode === "hybrid" ? [vec, kw] : [vec]);
        const ranked = rerank ? lexicalRerank(query, fused, topK) : fused.slice(0, topK);

        const dists = vec.map((v) => v.distance).filter((d): d is number => d !== null);
        const bestDistance = dists.length ? Math.min(...dists) : null;

        // Confidence: a literal code match (score >= 1) always counts; otherwise the best vector
        // distance must be under RAG_MAX_DISTANCE. 0 = threshold disabled until calibrated with the eval.
        const maxDistance = envNum("RAG_MAX_DISTANCE", 0);
        const exactHit = kw.some((k) => (k.keywordScore ?? 0) >= 1);
        const confident =
            ranked.length > 0 && (maxDistance === 0 || exactHit || (bestDistance !== null && bestDistance <= maxDistance));

        const chunks: RetrievedChunk[] = ranked.map((c, i) => ({
            n: i + 1,
            id: c.id,
            text: c.text,
            source: String(c.metadata?.source ?? "unknown"),
            section: String(c.metadata?.section ?? ""),
            distance: c.distance,
        }));
        return { chunks, confident, bestDistance, mode };
    }

    // Plain excerpts with citation numbers. No instructions in here: how to use them is in the system prompt.
    static format(r: RetrievalResult): string {
        return "Retrieved excerpts:\n\n" + r.chunks.map((c) => `[${c.n}] ${c.source}\n${c.text}`).join("\n\n");
    }
}