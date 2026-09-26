import { VectorStore } from "./vectorStore/vector.store.js";
import * as fs from "fs";
import { randomUUID } from "node:crypto";
import * as path from "path";
import { GIMINI } from "../services/gimini.service.js";

const CHUNK_SIZE = Number(process.env.RAG_CHUNK_SIZE || 800);
const CHUNK_OVERLAP = Number(process.env.RAG_CHUNK_OVERLAP || 100);

function chunkText(text: string): string[] {
    const chunks: string[] = [];
    let i = 0;
    while (i < text.length) {
        const end = Math.min(text.length, i + CHUNK_SIZE);
        chunks.push(text.slice(i, end));
        i += CHUNK_SIZE - CHUNK_OVERLAP;
    }
    return chunks;
}

export async function ingestFolder(folderPath: string) {
    const Store = VectorStore.get();
    await Store?.init();

    if (!fs.existsSync(folderPath)) {
        console.error(`Folder path not found: ${folderPath}`);
        return;
    }

    const files = fs.readdirSync(folderPath);
    for (const file of files) {
        if (!file.endsWith('.md') && !file.endsWith('.txt')) continue;

        const filePath = path.join(folderPath, file);
        const rawData = fs.readFileSync(filePath, 'utf-8');
        const chunks = chunkText(rawData);

        console.log(`Processing ${file} (${chunks.length} chunks)...`);
        const embeddings = await GIMINI.generateEmbeddings(chunks);

        for (let i = 0; i < chunks.length; i++) {
            const id = randomUUID();
            await Store?.upsert({
                id,
                docId: filePath,
                chunkIndex: i,
                text: chunks[i],
                embedding: embeddings[i] || [],
                metadata: { source: file, path: filePath }
            });
        }

        console.log(`Successfully ingested ${file} (${chunks.length} chunks)`);
    }

    console.log("RAG Ingestion completed successfully!");
}

const targetFolder = process.argv[2] || "src/data/rag_docs";
ingestFolder(targetFolder).catch((err) => {
    console.error("Ingest error:", err);
    process.exit(1);
});