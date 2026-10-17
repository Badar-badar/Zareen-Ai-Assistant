import { Request, Response } from "express";
import { GIMINI } from "../services/gimini.service.js";
import { SESSION } from "../config/session.js";
import { openSession } from "../mcp/session.js";
import { toRole } from "../mcp/permissions.js";
import {
    getSession, startSession, appendExchange, deleteSession, buildHistory,
} from "../services/session.service.js";

export class AgentController {
    static async chat(req: Request, res: Response) {
        const { message, sessionId } = req.body as { message: string; sessionId?: string };
        const userId = req.user!.id; // from the verified token, never from the body
        const role = toRole(req.user!.role);

        try {
            let history: ReturnType<typeof buildHistory> = [];
            if (sessionId) {
                const session = await getSession(userId, sessionId);
                if (!session) return res.status(404).json({ error: "Session not found" });
                history = buildHistory(session.messages, SESSION.historyCharBudget);
            }

            // One MCP server + client per request, built for THIS user, closed when done
            const mcp = await openSession({ userId, role });
            let result;
            try {
                result = await GIMINI.generateResponseWithTools(message, mcp.client, { userId, history });
            } finally {
                await mcp.close();
            }

            let activeSessionId = sessionId;
            if (result.stopReason === "done") {
                if (sessionId) await appendExchange(userId, sessionId, message, result.reply);
                else activeSessionId = await startSession(userId, message, result.reply);
            }

            return res.json({
                reply: result.reply,
                sessionId: activeSessionId,
                stopReason: result.stopReason,
                steps: result.steps,
                pendingActions: result.pendingActions,
            });
        } catch (error) {
            console.error("Agent chat error:", error);
            return res.status(500).json({ error: "Failed to get response from model" });
        }
    }

    static async deleteSession(req: Request, res: Response) {
        const ok = await deleteSession(req.user!.id, req.params.sessionId as string);
        return ok ? res.status(204).end() : res.status(404).json({ error: "Session not found" });
    }
}

export const agentController = AgentController;