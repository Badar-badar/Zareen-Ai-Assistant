import fs from "node:fs";
import path from "node:path";
import cosineSimilarity from "compute-cosine-similarity";
import GiminiProvider from "./GiminiProvider.js";
import OpenAiProvider from "./OpenAiProvider.js";

class RagProvider {
    constructor() {
        this.gemini = new GiminiProvider();
        this.openai = new OpenAiProvider();
        this.documents = this.loadKnowledgeBase();
        this.cachedEmbeddings = {};
    }

    /**
     * Choose provider dynamically:
     * Defaults to Gemini. If model includes 'gpt' or provider is 'openai', uses OpenAI.
     */
    getProvider(model, provider) {
        if (provider === "openai" || (model && model.toLowerCase().includes("gpt"))) {
            return this.openai;
        }
        return this.gemini;
    }

    loadKnowledgeBase() {
        const dataDir = path.join(process.cwd(), 'data');
        const docs = [];

        // Load Faqs.json
        const faqsPath = path.join(dataDir, 'Faqs.json');
        if (fs.existsSync(faqsPath)) {
            try {
                const faqs = JSON.parse(fs.readFileSync(faqsPath, 'utf-8'));
                if (Array.isArray(faqs)) docs.push(...faqs);
            } catch (err) {
                console.error("Error reading Faqs.json:", err);
            }
        }

        // Load KnowledgeBase.json
        const kbPath = path.join(dataDir, 'KnowledgeBase.json');
        if (fs.existsSync(kbPath)) {
            try {
                const kb = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
                if (Array.isArray(kb)) docs.push(...kb);
            } catch (err) {
                console.error("Error reading KnowledgeBase.json:", err);
            }
        }

        // Deduplicate documents by question
        const uniqueDocs = [];
        const seenQuestions = new Set();
        for (const doc of docs) {
            const question = doc.Question || doc.question;
            const answer = doc.Answer || doc.answer;
            if (!question || !answer) continue;

            const key = question.trim().toLowerCase();
            if (!seenQuestions.has(key)) {
                seenQuestions.add(key);
                uniqueDocs.push({ Question: question, Answer: answer });
            }
        }

        return uniqueDocs;
    }

    async getEmbeddings(aiProvider) {
        const key = aiProvider.constructor.name;
        if (!this.cachedEmbeddings[key]) {
            const docTexts = this.documents.map(
                (doc) => `Question: ${doc.Question}\nAnswer: ${doc.Answer}`
            );
            this.cachedEmbeddings[key] = await aiProvider.embedDocuments(docTexts);
        }
        return this.cachedEmbeddings[key];
    }

    async retrieveRelevantDocuments(userQuery, aiProvider, topK = 3) {
        const docEmbeddings = await this.getEmbeddings(aiProvider);
        if (!docEmbeddings || docEmbeddings.length === 0) return [];

        const queryEmbedding = await aiProvider.embedQuery(userQuery);
        if (!queryEmbedding) return [];

        const scoredDocs = this.documents.map((doc, idx) => {
            const docEmb = docEmbeddings[idx];
            const similarity = docEmb && queryEmbedding ? (cosineSimilarity(queryEmbedding, docEmb) || 0) : 0;
            return { ...doc, score: similarity };
        });

        scoredDocs.sort((a, b) => b.score - a.score);
        return scoredDocs.slice(0, topK);
    }

    /**
     * Get RAG response dynamically. Default is Gemini; uses OpenAI if model/provider is specified.
     */
    async getResponseWithRAG(userQuery, { model, provider } = {}) {
        try {
            const aiProvider = this.getProvider(model, provider);
            const relevantDocs = await this.retrieveRelevantDocuments(userQuery, aiProvider, 3);

            const contextText = relevantDocs
                .map((d, i) => `[Doc ${i + 1}]\nQ: ${d.Question}\nA: ${d.Answer}`)
                .join("\n\n");

            const systemPrompt = `You are a helpful customer support AI assistant.
Use ONLY the following retrieved knowledge base information to answer the user's question.
If the information is not present in the retrieved knowledge base, respond politely with:
"I don't have this information in my knowledge base. Please contact customer support at 1800-123-4567 or support@zareena.com."

Retrieved Knowledge Base Context:
${contextText || "No matching documents found."}

User Question: ${userQuery}`;

            return await aiProvider.generateResponse(systemPrompt, model);
        } catch (error) {
            console.error('RAG Provider Error:', error);
            throw error;
        }
    }

    // Alias for backward compatibility
    async geminiResponseWithRAG(userQuery, options) {
        return this.getResponseWithRAG(userQuery, options);
    }
}

export default RagProvider;