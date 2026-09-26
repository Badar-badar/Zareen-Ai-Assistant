import { VectorStoreChroma } from "./dbs/chroma.db.js";
import { VectorStorePg } from "./dbs/pgVector.db.js";

export class VectorStore {
    static get() {
        const backend = process.env.VECTOR_DB || 'chroma';
        if (backend === 'chroma') return VectorStoreChroma;

        if (backend === 'pgvector') return VectorStorePg;

        throw new Error("Invalid VECTOR_DB value. Use pgvector or chroma.");
    }
}