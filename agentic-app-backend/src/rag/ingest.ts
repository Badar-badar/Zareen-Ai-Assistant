import { VectorStore } from "./vectorStore/vector.store.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import { GIMINI } from "../services/gimini.service.js";
import { chunkMarkdown } from "./chunker.js";

const MAX = Number(process.env.RAG_CHUNK_SIZE || 900);
const OVERLAP = Number(process.env.RAG_CHUNK_OVERLAP || 100);
const BATCH = 16;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function embedWithRetry(texts: string[], tries = 4): Promise<number[][]> {
    for (let attempt = 1; ; attempt++) {
        try {
            return await GIMINI.generateEmbeddings(texts);
        } catch (err) {
            if (attempt >= tries) throw err;
            await sleep(500 * 2 ** attempt);
        }
    }
}

export async function ingestFolder(folderPath: string) {
    const Store: any = VectorStore.get();
    await Store.init();

    if (!fs.existsSync(folderPath)) {
        console.error(`Folder path not found: ${folderPath}`);
        return;
    }

    const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".md") || f.endsWith(".txt"));
    const seen = new Set<string>();

    for (const file of files) {
        const docId = file; // stable across machines (not an absolute path)
        seen.add(docId);
        const raw = fs.readFileSync(path.join(folderPath, file), "utf-8");
        // Chunk settings are part of the hash, so changing them re-ingests everything
        const docHash = sha(`${raw}|${MAX}|${OVERLAP}`);

        if ((await Store.getDocHash(docId)) === docHash) {
            console.log(`Skipping ${file} (unchanged)`);
            continue;
        }

        const chunks = chunkMarkdown(raw, { maxChars: MAX, overlapChars: OVERLAP });
        console.log(`Processing ${file} (${chunks.length} chunks)...`);

        // Embed everything first: if this fails, the old chunks are still in place
        const embeddings: number[][] = [];
        for (let i = 0; i < chunks.length; i += BATCH) {
            const part = await embedWithRetry(chunks.slice(i, i + BATCH).map((c) => c.text));
            embeddings.push(...part);
        }
        if (embeddings.length !== chunks.length || embeddings.some((e) => !e.length)) {
            throw new Error(`Embedding failed for ${file}`);
        }

        await Store.deleteByDoc(docId);
        for (let i = 0; i < chunks.length; i++) {
            await Store.upsert({
                id: sha(`${docId}#${i}#${chunks[i].text}`).slice(0, 32), // same text, same id
                docId,
                chunkIndex: i,
                text: chunks[i].text,
                embedding: embeddings[i],
                metadata: { source: file, section: chunks[i].section, docHash, chunkCount: chunks.length },
            });
        }
        console.log(`Ingested ${file}`);
    }

    // Remove chunks of files that no longer exist (including old random-id rows)
    for (const docId of await Store.listDocIds()) {
        if (!seen.has(docId)) {
            await Store.deleteByDoc(docId);
            console.log(`Removed stale document ${docId}`);
        }
    }

    console.log("RAG ingestion completed.");
}

const targetFolder = process.argv[2] || "src/data/rag_docs";
ingestFolder(targetFolder)
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Ingest error:", err);
        process.exit(1);
    });