import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { RagEngine } from "../../../rag/ragEngine.js";

export function registerRagTools(mcpServer: McpServer) {
  mcpServer.registerTool(
    "ragSearch",
    {
      title: "RAG Search",
      description:
        "Search the store's knowledge base and product documentation: shipping, returns, refunds, payments, warranty, product specs. " +
        "Returns numbered excerpts. Not for live order or customer data.",
      inputSchema: z.object({
        query: z.string().min(1).max(500).describe("What to look up"),
        topK: z.number().int().min(1).max(10).optional().describe("Number of excerpts to retrieve"),
      }),
    },
    async ({ query, topK }) => {
      try {
        const r = await RagEngine.retrieve(query, { topK: topK ?? 4 });
        if (!r.confident || r.chunks.length === 0) {
          return {
            content: [{ type: "text", text: "No relevant documents found for this query." }],
            structuredContent: { sources: [] },
          };
        }
        return {
          content: [{ type: "text", text: RagEngine.format(r) }],
          structuredContent: {
            sources: r.chunks.map((c) => ({ n: c.n, source: c.source, section: c.section })),
          },
        };
      } catch (error: any) {
        console.error("RAG tool error", error?.message);
        return {
          content: [{ type: "text", text: "Knowledge search failed. Tell the user it did not work; do not retry." }],
          isError: true,
        };
      }
    }
  );
}