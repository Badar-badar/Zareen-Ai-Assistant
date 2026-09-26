import fs from "node:fs";
import path from "node:path";
import cosineSimilarity from "compute-cosine-similarity";
import GiminiProvider from "./GiminiProvider.js";

class RagProviderCopy {
    constructor() {
        this.gemini = new GiminiProvider();
        this.documents = this.loadKnowledgeBase();
        this.cachedEmbeddings = {};
    }

    loadKnowledgeBase() {
        const dataDir = path.join(process.cwd(), 'data');
        const docs = [];

        const faqsPath = path.join(dataDir, 'Faqs.json');
        if (fs.existsSync(faqsPath)) {
            try {
                const faqs = JSON.parse(fs.readFileSync(faqsPath, 'utf-8'));
                if (Array.isArray(faqs)) docs.push(...faqs);
            } catch (err) {
                console.error("Error reading Faqs.json:", err);
            }
        }

        const kbPath = path.join(dataDir, 'KnowledgeBase.json');
        if (fs.existsSync(kbPath)) {
            try {
                const kb = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
                if (Array.isArray(kb)) docs.push(...kb);
            } catch (err) {
                console.error("Error reading KnowledgeBase.json:", err);
            }
        }

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

    async getEmbeddings() {
        const key = "gemini";
        if (!this.cachedEmbeddings[key]) {
            const docTexts = this.documents.map(
                (doc) => `Question: ${doc.Question}\nAnswer: ${doc.Answer}`
            );
            this.cachedEmbeddings[key] = await this.gemini.embedDocuments(docTexts);
        }
        return this.cachedEmbeddings[key];
    }

    async retrieveRelevantDocuments(userQuery, topK = 3) {
        const docEmbeddings = await this.getEmbeddings();
        if (!docEmbeddings || docEmbeddings.length === 0) return [];

        const queryEmbedding = await this.gemini.embedQuery(userQuery);
        if (!queryEmbedding) return [];

        const scoredDocs = this.documents.map((doc, idx) => {
            const docEmb = docEmbeddings[idx];
            const similarity = docEmb && queryEmbedding ? (cosineSimilarity(queryEmbedding, docEmb) || 0) : 0;
            return { ...doc, score: similarity };
        });

        scoredDocs.sort((a, b) => b.score - a.score);
        return scoredDocs.slice(0, topK);
    }

    async getResponseWithRAG(userQuery, { model } = {}) {
        try {
            const relevantDocs = await this.retrieveRelevantDocuments(userQuery, 3);

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

            return await this.gemini.generateResponse(systemPrompt, model);
        } catch (error) {
            console.error('RAG Provider Copy Error:', error);
            throw error;
        }
    }

    async geminiResponseWithRAG(userQuery, options) {
        return this.getResponseWithRAG(userQuery, options);
    }
}

export default RagProviderCopy;
