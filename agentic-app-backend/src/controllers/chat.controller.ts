import { Request, Response } from "express";
import { GIMINI } from "../services/gimini.service.js";

export const chatController = {
    getChatResponse: async (req: Request, res: Response) => {
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }
        try {
            const response = await GIMINI.generateResponse(message);
            res.json({ reply: response });
        } catch (error) {
            console.error("Error in chat controller:", error);
            res.status(500).json({ error: "Something went wrong" });
        }
    }
}