import { GoogleGenAI, mcpToTool } from "@google/genai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";


export class GiminiService {
    apiKey: string;
    model: string;
    embeddingModel: string;
    gemini: GoogleGenAI;

    constructor(
        model: string = process.env.GOOGLE_AI_MODEL || "gemini-3.5-flash-lite",
        embeddingModel: string = process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001"
    ) {
        this.apiKey = (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "") as string;
        this.model = model;
        this.embeddingModel = embeddingModel;
        this.gemini = new GoogleGenAI({ apiKey: this.apiKey });
    }

    async generateResponse(message: string): Promise<string> {
        try {
            const response = await this.gemini.models.generateContent({
                model: this.model,
                contents: message,
            });
            return response.text ?? "No response from Gemini";
        } catch (error: any) {
            console.error("Error in generateResponse:", error);
            throw error;
        }
    }

    async generateResponseWithTools(prompt: string, mcpClient: Client): Promise<string> {
        try {
            const response = await this.gemini.models.generateContent({
                model: this.model,
                contents: [
                    {
                        role: "user",
                        parts: [{ text: prompt }]
                    }
                ],
                config: {
                    systemInstruction: {
                        parts: [
                            {
                                text: `You are an AI assistant for Zareena's ERP and Store.
TOOLS AVAILABLE:
- Customer tools: getCustomers, getCustomerById (use for customer info)
- Order tools: getLatestOrders, getOrderWithCustomerDetails, getOrderById (use for customer orders, purchases, spending, and sales data)
- Weather tools: fetchWeather (use for weather information)
- RAG tool: ragSearch (use for company knowledge base, return/refund/shipping policies, and product documentation)

RULES:
1. When asked about customer spending, purchases, top buyers, or order history, use getOrderWithCustomerDetails or getLatestOrders.
2. When asked about store policies, shipping/refund rules, FAQs, or general docs, use the ragSearch tool.
3. For weather inquiries, use fetchWeather.
4. If no specific tool is relevant, answer using your general knowledge.
5. Be concise, direct, and do not mention internal tool names unless requested.`
                            }
                        ]
                    },
                    tools: [mcpToTool(mcpClient)]
                }
            });

            return this.extractResponseText(response) ?? "No response from Gemini";
        } catch (error: any) {
            console.error("Error in generateResponseWithTools:", error);
            throw error;
        }
    }

    extractResponseText(response: any): string {
        const candidate = response?.candidates?.[0];
        if (!candidate) return "";

        const textPart = candidate.content?.parts?.find((part: any) => part.text);
        if (textPart && textPart.text) {
            return textPart.text.trim();
        }

        const structuredPart = candidate.content?.parts?.find(
            (p: any) => p.functionResponse?.response?.structuredContent
        );

        if (structuredPart) {
            return (
                "Tool executed successfully, but no natural language response was provided. Raw data:\n" +
                JSON.stringify(structuredPart.functionResponse.response.structuredContent, null, 2)
            );
        }

        return "No text found in response";
    }

    async generateEmbeddings(data: string | string[], taskType = "RETRIEVAL_DOCUMENT"): Promise<number[][]> {
        try {
            const texts = Array.isArray(data) ? data : [data];
            const embeddings: number[][] = [];

            for (const text of texts) {
                const response = await this.gemini.models.embedContent({
                    model: this.embeddingModel,
                    contents: text,
                    config: {
                        taskType: taskType as any,
                    }
                });

                const values = response.embeddings?.[0]?.values;
                if (values) {
                    embeddings.push(values);
                } else {
                    embeddings.push([]);
                }
            }

            return embeddings;
        } catch (error: any) {
            console.error("Error in generateEmbeddings:", error);
            throw error;
        }
    }
}

export const GIMINI = new GiminiService();
