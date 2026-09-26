import { MCPClient } from "../mcp/client/mcp-client.service.js";
import { Request, Response } from "express";
import { GIMINI } from "../services/gimini.service.js";

export class AgentController {
    static async chat(req: Request, res: Response) {
        const { message } = req.body;
        if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

        try {
            const mcp = await MCPClient.init();
            const LLM = GIMINI;

            const response = await LLM.generateResponseWithTools(message, mcp.client);
            return res.json({ reply: response });

        } catch (error) {
            console.error("Agent chat error:", error);
            return res.status(500).json({ success: false, message: 'Failed to get response from model' });
        }
    }
}

export const agentController = AgentController;   