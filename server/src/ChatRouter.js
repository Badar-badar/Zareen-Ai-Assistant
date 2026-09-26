import express from "express";
import RagProvider from "./RagProvider.js";

const router = express.Router();
const ragProvider = new RagProvider();

router.post("/chat", async (req, res) => {
    const { message, model, provider } = req.body;
    if (!message) {
        return res.status(400).json({ error: "Message is required" });
    }
    try {
        // Default is Gemini; automatically uses OpenAI if model/provider is passed
        const reply = await ragProvider.getResponseWithRAG(message, { model, provider });
        res.json({ reply });
    } catch (error) {
        console.error("Chat Router Error:", error);
        res.status(500).json({ error: error.message || "Internal server error" });
    }
});

export default router;
