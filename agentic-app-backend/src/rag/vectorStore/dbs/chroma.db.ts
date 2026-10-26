import { ChromaClient } from "chromadb";
import { randomUUID } from "node:crypto";

const client = new ChromaClient({
    ssl: process.env.CHROMA_SSL === "true",
    host: process.env.CHROMA_HOST || "localhost",
    port: parseInt(process.env.CHROMA_PORT || "8000"),
});

const COLLECTION = process.env.CHROMA_COLLECTION || "rag_docs";

export class VectorStoreChroma {
    private static collection: any;

    static async init() {
        this.collection = await client.getOrCreateCollection({ name: COLLECTION });
        return this.collection;
    }

    static async upsert(params: {
        id: string;
        docId: string;
        chunkIndex: number;
        text: string;
        embedding: number[];
        metadata?: Record<string, any>;
    }) {
        const { id, docId, chunkIndex, text, embedding, metadata = {} } = params;

        await this.collection.upsert({
            ids: [id],
            embeddings: [embedding],
            documents: [text],
            metadatas: [{ ...metadata, docId, chunkIndex }]
        });
    }

    static async search(embedding: number[], topK: number = 4) {
        const res = await this.collection.query({
            queryEmbeddings: [embedding],
            nResults: topK,
        });

        const docs = res.documents?.[0] || [];
        return docs.map((doc: string, i: number) => ({
            id: res.ids?.[0]?.[i] ?? randomUUID(),
            text: doc,
            metadata: res.metadatas?.[0]?.[i] ?? {},
            score: res.distances?.[0]?.[i] ?? null
        }));
    }


    static async deleteByDoc(docId: string) {
        await this.collection.delete({ where: { docId } });
    }

    static async getDocHash(docId: string): Promise<string | null> {
        const res = await this.collection.get({ where: { docId }, include: ["metadatas"] });
        const metas = res.metadatas ?? [];
        if (!metas.length) return null;
        const m: any = metas[0] ?? {};
        return m.chunkCount === metas.length ? (m.docHash ?? null) : null;
    }

    static async listDocIds(): Promise<string[]> {
        const res = await this.collection.get({ include: ["metadatas"] });
        return [...new Set<string>((res.metadatas ?? []).map((m: any) => m?.docId).filter(Boolean))];
    }
}