import { Pool } from "pg";
import * as pgvector from "pgvector/pg";

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
});

pool.on('connect', async (client) => {
    console.log('connected to PostgresSQL');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector');
    await pgvector.registerType(client);
    console.log('pgvector extension registered');
});

export class VectorStorePg{
     private static initialized = false;
     private static table = process.env.PGVECTOR_TABLE || 'rag_vectors';
     private static dims = Number(process.env.EMBEDDING_DIMS) || 3072;
     
     static async init() {
        if (VectorStorePg.initialized) return;

        const client = await pool.connect();
        try {
            await client.query(`
                CREATE TABLE IF NOT EXISTS ${VectorStorePg.table} (
                    id TEXT PRIMARY KEY,
                    doc_id TEXT,
                    chunk_index INT,
                    content TEXT,
                    metadata JSONB,
                    embedding vector(${VectorStorePg.dims || 3072})
                );
            `);
            VectorStorePg.initialized = true;
            console.log('pgvector table created');
        } finally {
            client.release();
        }
     }

     static async upsert(params:{
        id: string;
        docId: string;
        chunkIndex: number;
        text: string;
        metadata: Record<string, any>;
        embedding: number[];
     }){
        const {id, docId, chunkIndex, text, metadata, embedding} = params;
        if(embedding.length !== this.dims){
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
            console.log('pgvector upserted');
        
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
            metadata:{
                docId: row.doc_id,
                chunkIndex:row.chunk_index,
                ...row.metadata,
            },
            score:row.distance
        }));
        
     }
    
}