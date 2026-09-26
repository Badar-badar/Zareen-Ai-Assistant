import OpenAI from "openai";

class OpenAiProvider {
    constructor(apiKey = process.env.OPENAI_API_KEY, model = "gpt-4o-mini", embeddingModel = "text-embedding-3-small") {
        this.apiKey = apiKey;
        this.model = model;
        this.embeddingModel = embeddingModel;
        this.openai = new OpenAI({ apiKey: this.apiKey || "DUMMY_KEY" });
    }

    /**
     * Generate text response dynamically
     * @param {string} prompt - User prompt
     * @param {string} [model] - Dynamic model override (e.g., "gpt-4o")
     */
    async generateResponse(prompt, model = this.model) {
        if (!this.apiKey) {
            throw new Error("Please provide an OpenAI API key");
        }

        const response = await this.openai.chat.completions.create({
            model: model,
            messages: [{ role: "user", content: prompt }],
        });

        return response.choices[0]?.message?.content || "";
    }

    /**
     * Generate embeddings dynamically (string or array of strings)
     * @param {string|string[]} input - String or array of strings
     * @param {string} [model] - Dynamic embedding model override
     */
    async createEmbedding(input, model = this.embeddingModel) {
        if (!this.apiKey) {
            throw new Error("Please provide an OpenAI API key");
        }

        const response = await this.openai.embeddings.create({
            model: model,
            input: input,
            encoding_format: "float",
        });

        if (Array.isArray(input)) {
            return response.data.map((item) => item.embedding);
        }
        return response.data[0]?.embedding || [];
    }

    async embedDocuments(contents) {
        return this.createEmbedding(contents);
    }

    async embedQuery(content) {
        return this.createEmbedding(content);
    }
}

export default OpenAiProvider;
