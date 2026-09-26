import { VectorStore } from "./vectorStore/vector.store.js";
import { GIMINI } from "../services/gimini.service.js";
interface RAGCHUNK{
    id: string,
    text: string,
    metadata: any,
    score: number | null;
}
export class RagEngine{
    static async buildPrompt(query: string, topK: number = 4){
        try {
              const Store = VectorStore.get();
              await Store.init();
              console.log("Rag: Vector store initialized");

              console.log("Rag: Generating embeddings...");
              const [queryEmbedding] = await GIMINI.generateEmbeddings(query);
              if(!queryEmbedding){
                throw new Error("failed to create embeddings");
              }
              console.log("Rag: Embedding generated");
              
              if(queryEmbedding.length !== Number(process.env.EMBEDDING_DIMS)){
                throw new Error(`Embedding dimension mismatch Expected ${process.env.EMBEDDING_DIMS} but got ${queryEmbedding.length}`);
              }

            //   const embeddings = queryEmbedding as number[];
              console.log("Rag: Querying vector store...");
              const results = await Store.search(queryEmbedding, topK);
              if(!results.length){
                 return {
                    prompt: `No matching documents found for query: ${query}`,
                    sources:[],
                 }
              }
              const context = results.map((r: RAGCHUNK, i: number) =>
               `Source ${i+1} :\n${r.text}\nMETA: ${JSON.stringify(r.metadata)}\nSCORE: ${r.score?.toFixed(4)}:`).join("\n\n");

              const prompt = `
                    You are a helpful assistant.
                    Use the following context to answer the query.
                    If the answer is not in the context, say so.

                    Context:
                    ${context}

                    Query:
                    ${query}

                    Answer:
                    `;

                return {prompt, sources: results};
        } catch (error) {
                console.error("Rag: Error building prompt", error);
                throw error;
        }
    }
}