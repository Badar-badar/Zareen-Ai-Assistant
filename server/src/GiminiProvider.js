import { GoogleGenAI } from "@google/genai";

class GiminiProvider {
    constructor(apiKey = process.env.GOOGLE_API_KEY, model = "gemini-3.6-flash", embeddingModel = "gemini-embedding-001") {
        this.apiKey = apiKey;
        this.model = model || "gemini-3.6-flash";
        this.embeddingModel = embeddingModel || "gemini-embedding-001";

        if (this.apiKey) {
            this.ai = new GoogleGenAI({ apiKey: this.apiKey });
        }
    }

    /**
     * Generate content with Gemini dynamically
     * @param {string} prompt - User prompt
     * @param {string} [model] - Dynamic model override
     */
    async geminiResponse(prompt, model = this.model) {
        if (!this.ai) {
            throw new Error("Please provide a Gemini API key");
        }

        const targetModel = model || this.model;
        const candidateModels = Array.from(new Set([targetModel, "gemini-3.6-flash", "gemini-3.5-flash-lite", "gemini-3.7-flash"]));
        let lastError = null;

        for (const modelName of candidateModels) {
            try {
                const response = await this.ai.models.generateContent({
                    model: modelName,
                    contents: prompt,
                });
                return response.text;
            } catch (error) {
                console.warn(`Gemini Provider warning for model ${modelName}:`, error.message || error);
                lastError = error;
            }
        }

        console.error("All Gemini models failed:", lastError);
        throw new Error(lastError?.message || "Failed to generate Gemini response");
    }

    // Alias for standardized provider interface
    async generateResponse(prompt, model = this.model) {
        return this.geminiResponse(prompt, model);
    }

    /**
     * Generate embeddings for documents
     * @param {string[]} contents - Array of document text strings
     */
    async embedDocuments(contents) {
        if (!this.ai) throw new Error("Please provide a Gemini API key");

        try {
            const response = await this.ai.models.embedContent({
                model: this.embeddingModel,
                contents: contents,
                config: { taskType: "RETRIEVAL_DOCUMENT" },
            });

            if (response.embeddings) {
                return response.embeddings.map((e) => e.values);
            }
            if (response.embedding) {
                return [response.embedding.values];
            }
            return [];
        } catch (error) {
            console.error("Gemini embedDocuments Error:", error);
            throw error;
        }
    }

    /**
     * Generate embedding for search query
     * @param {string} content - Search query string
     */
    async embedQuery(content) {
        if (!this.ai) throw new Error("Please provide a Gemini API key");

        try {
            const response = await this.ai.models.embedContent({
                model: this.embeddingModel,
                contents: content,
                config: { taskType: "RETRIEVAL_QUERY" },
            });

            if (response.embeddings && response.embeddings.length > 0) {
                return response.embeddings[0].values;
            }
            if (response.embedding) {
                return response.embedding.values;
            }
            return null;
        } catch (error) {
            console.error("Gemini embedQuery Error:", error);
            throw error;
        }
    }
}

export default GiminiProvider;