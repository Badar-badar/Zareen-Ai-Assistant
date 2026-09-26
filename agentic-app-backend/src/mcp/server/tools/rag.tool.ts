import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RagEngine } from "../../../rag/ragEngine.js";

export function registerRagTools(mcpServer: McpServer) {
  console.log("Registering RAG Tool");

  mcpServer.registerTool(
    "ragSearch",
    {
      title: "RAG Search",
      description: "Search through the indexed documents using semantic similarity.",
      inputSchema: z.object({
        query: z.string().describe("Search query for semantic document retrieval"),
        topK: z.number().optional().describe("Number of top relevant chunks to retrieve"),
      }),
    },
    async ({ query, topK }) => {
      try {
        const result = await RagEngine.buildPrompt(query, topK);
        return {
          content: [{ type: "text", text: result.prompt }],
          structuredContent: { prompt: result.prompt, sources: result.sources },
        };
      } catch (error: any) {
        console.log("RAG Tool Error", error);
        return {
          content: [{ type: "text", text: "RAG tool failed. Please try again." }],
          structuredContent: { error: JSON.stringify(error) },
        };
      }
    }
  );
}