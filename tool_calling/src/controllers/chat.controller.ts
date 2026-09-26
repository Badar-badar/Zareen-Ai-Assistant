import { Request, Response } from "express";
import { giminiService } from "../services/gimini.service.ts";

export const chatController = {
    getChatResponse: async (req:Request, res:Response) => {
        const prompt = req.body.prompt || req.body.message;
        if (!prompt) {
            return res.status(400).json({ error: "prompt is required" });
        }
        try {
            const provider = new giminiService();
            const response = await provider.generateResponseWithTools(prompt);
            res.json({ reply: response });
        } catch (error) {
            console.error("Error in chat controller:", error);
            res.status(500).json({ error: "Something went wrong" });
        }
    }
}