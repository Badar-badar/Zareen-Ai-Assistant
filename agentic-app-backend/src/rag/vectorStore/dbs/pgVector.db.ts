import { Pool } from "pg";
import * as pgvector from "pgvector/pg";
import { buildTsQuery, extractCodes } from "../../text.js";

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
});

pool.on('connect', async (client) => {
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    await pgvector.registerType(client);
});

const escapeLike = (s: string) => s.replace(/[\\%_]/g, "\\$&");

export class VectorStorePg {
    private static initialized = false;
    private static table = process.env.PGVECTOR_TABLE || 'rag_vectors';
    private static dims = Number(process.env.EMBEDDING_DIMS) || 1536;

    static async init() {
        if (VectorStorePg.initialized) return;
        const t = VectorStorePg.table;
        const client = await pool.connect();
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS ${t} (
                    id TEXT PRIMARY KEY,
                    doc_id TEXT,
                    chunk_index INT,
                    content TEXT,
                    metadata JSONB,
                    embedding vector(${VectorStorePg.dims})
                );
            `);
            // Keyword search column, kept in sync by Postgres itself
            await client.query(`
                ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS fts tsvector
                GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
            `);
            await client.query(`CREATE INDEX IF NOT EXISTS ${t}_fts_idx ON ${t} USING GIN (fts)`);
            await client.query(`CREATE INDEX IF NOT EXISTS ${t}_doc_idx ON ${t} (doc_id)`);
            // pgvector indexes support at most 2000 dimensions; above that, search scans every row
            if (VectorStorePg.dims <= 2000) {
                await client.query(
                    `CREATE INDEX IF NOT EXISTS ${t}_hnsw_idx ON ${t} USING hnsw (embedding vector_cosine_ops)`
                );
            } else {
                console.warn(`EMBEDDING_DIMS=${VectorStorePg.dims} is above 2000: no vector index, search will be slow at scale`);
            }
            VectorStorePg.initialized = true;
        } finally {
            client.release();
        }
    }

    static async upsert(params: {
        id: string;
        docId: string;
        chunkIndex: number;
        text: string;
        metadata: Record<string, any>;
        embedding: number[];
    }) {
        const { id, docId, chunkIndex, text, metadata, embedding } = params;
        if (embedding.length !== this.dims) {
            throw new Error(`Embedding dimension must be ${this.dims}`);
        }
        await pool.query(`
            INSERT INTO ${VectorStorePg.table} (id, doc_id, chunk_index, content, metadata, embedding)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
            content = EXCLUDED.content,
            metadata = EXCLUDED.metadata,
            embedding = EXCLUDED.embedding
        `, [id, docId, chunkIndex, text, JSON.stringify(metadata), pgvector.toSql(embedding)]);
    }

    static async search(embedding: number[], topK: number = 4) {
        const result = await pool.query(`
            SELECT id, doc_id, chunk_index, content, metadata, embedding <=> $1 AS distance
            FROM ${VectorStorePg.table}
            ORDER BY embedding <=> $1
            LIMIT $2
        `, [pgvector.toSql(embedding), topK]);
        return result.rows.map(row => ({
            id: row.id,
            text: row.content,
            metadata: { docId: row.doc_id, chunkIndex: row.chunk_index, ...row.metadata },
            score: Number(row.distance),
        }));
    }

    // Word search (stemmed, OR) plus literal matches for codes like item-06
    static async keywordSearch(query: string, topK: number = 4) {
        const tsq = buildTsQuery(query) ?? "";
        const codes = extractCodes(query).map((c) => `%${escapeLike(c)}%`);
        if (!tsq && codes.length === 0) return [];
        const result = await pool.query(`
            SELECT id, doc_id, chunk_index, content, metadata,
                   ts_rank(fts, to_tsquery('english', $1))
                   + (CASE WHEN content ILIKE ANY($2::text[]) THEN 1 ELSE 0 END) AS score
            FROM ${VectorStorePg.table}
            WHERE fts @@ to_tsquery('english', $1) OR content ILIKE ANY($2::text[])
            ORDER BY score DESC
            LIMIT $3
        `, [tsq, codes, topK]);
        return result.rows.map(row => ({
            id: row.id,
            text: row.content,
            metadata: { docId: row.doc_id, chunkIndex: row.chunk_index, ...row.metadata },
            score: Number(row.score),
        }));
    }

    static async deleteByDoc(docId: string) {
        const res = await pool.query(`DELETE FROM ${VectorStorePg.table} WHERE doc_id = $1`, [docId]);
        return res.rowCount ?? 0;
    }

    // Returns the stored file hash only if ALL of the file's chunks are present (a half-finished ingest returns null)
    static async getDocHash(docId: string): Promise<string | null> {
        const res = await pool.query(`
            SELECT metadata->>'docHash' AS h, (metadata->>'chunkCount')::int AS n, count(*) OVER () AS c
            FROM ${VectorStorePg.table} WHERE doc_id = $1 LIMIT 1
        `, [docId]);
        const row = res.rows[0];
        return row && Number(row.c) === row.n ? row.h : null;
    }

    static async listDocIds(): Promise<string[]> {
        const res = await pool.query(`SELECT DISTINCT doc_id FROM ${VectorStorePg.table}`);
        return res.rows.map((r) => r.doc_id);
    }
}