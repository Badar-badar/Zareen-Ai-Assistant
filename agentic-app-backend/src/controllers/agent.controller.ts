import { Request, Response } from "express";
import { GIMINI } from "../services/gimini.service.js";
import { SESSION } from "../config/session.js";
import { openSession } from "../mcp/session.js";
import { toRole } from "../mcp/permissions.js";
import { overDailyLimit } from "../obs/store.js";
import { orchestrate } from "../agent/orchestrator.js";
import {
    getSession, startSession, appendExchange, deleteSession, buildHistory,
} from "../services/session.service.js";
const MAX_BUFFERED_BYTES = 256 * 1024; // a client that falls this far behind is dropped
const streaming = new Set<string>(); // one live stream per user
export class AgentController {
    static async chat(req: Request, res: Response) {
        const { message, sessionId } = req.body as { message: string; sessionId?: string };
        const userId = req.user!.id; // from the verified token, never from the body
        const role = toRole(req.user!.role);
        if (await overDailyLimit(userId)) {
            return res.status(429).json({ error: "Daily usage limit reached. Try again tomorrow." });
        }

        try {
            let history: ReturnType<typeof buildHistory> = [];
            if (sessionId) {
                const session = await getSession(userId, sessionId);
                if (!session) return res.status(404).json({ error: "Session not found" });
                history = buildHistory(session.messages, SESSION.historyCharBudget);
            }
            let result;
            if (process.env.AGENT_MODE === "team") {
                result = await orchestrate({ message, userId, role, history });
            } else {
                const mcp = await openSession({ userId, role });
                try {
                    result = await GIMINI.generateResponseWithTools(message, mcp.client, { userId, history });
                } finally {
                    await mcp.close();
                }
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

    static async stream(req: Request, res: Response) {
        const { message, sessionId } = req.body as { message: string; sessionId?: string };
        const userId = req.user!.id;
        const role = toRole(req.user!.role);
       if (await overDailyLimit(userId)) {
            return res.status(429).json({ error: "Daily usage limit reached. Try again tomorrow." });
        }

        if (streaming.has(userId)) {
            return res.status(429).json({ error: "You already have a reply in progress." });
        }

        let history: ReturnType<typeof buildHistory> = [];
        try {
            if (sessionId) {
                const session = await getSession(userId, sessionId);
                if (!session) return res.status(404).json({ error: "Session not found" });
                history = buildHistory(session.messages, SESSION.historyCharBudget);
            }
        } catch (error) {
            console.error("Agent stream error:", error);
            return res.status(500).json({ error: "Failed to get response from model" });
        }

        streaming.add(userId);
        const ac = new AbortController();
        let finished = false;

        // Tab closed or Stop pressed: abort the model call
        res.on("close", () => {
            if (!finished) {
                ac.abort();
                console.warn(JSON.stringify({ type: "stream", event: "client_disconnected", userId }));
            }
        });

        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        });
        res.flushHeaders();

        const send = (event: string, data: unknown) => {
            if (res.writableEnded || res.destroyed) return;
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
            // Backpressure: the client is not reading fast enough, so stop spending tokens on it
            if (res.writableLength > MAX_BUFFERED_BYTES) {
                ac.abort();
                res.destroy();
            }
        };
        const ping = setInterval(() => {
            if (!res.writableEnded && !res.destroyed) res.write(": ping\n\n");
        }, 15_000);

        let mcp: Awaited<ReturnType<typeof openSession>> | undefined;
        try {
            mcp = await openSession({ userId, role });
            const result = await GIMINI.generateResponseWithTools(message, mcp.client, {
                userId,
                history,
                signal: ac.signal,
                onDelta: (text) => send("delta", { text }),
                onReset: () => send("reset", {}),
                onReplace: (text) => send("replace", { text }),
            });

            if (ac.signal.aborted) return; // cancelled: save nothing, send nothing

            let activeSessionId = sessionId;
            if (result.stopReason === "done") {
                if (sessionId) await appendExchange(userId, sessionId, message, result.reply);
                else activeSessionId = await startSession(userId, message, result.reply);
            }

            finished = true;
            send("done", {
                reply: result.reply,
                sessionId: activeSessionId,
                stopReason: result.stopReason,
                pendingActions: result.pendingActions,
            });
            res.end();
        } catch (error) {
            console.error("Agent stream error:", error);
            if (!ac.signal.aborted) {
                finished = true;
                send("error", { message: "Failed to get response from model" });
                res.end();
            }
        } finally {
            finished = true;
            clearInterval(ping);
            streaming.delete(userId);
            await mcp?.close().catch(() => {});
        }
    }

    static async deleteSession(req: Request, res: Response) {
        const ok = await deleteSession(req.user!.id, req.params.sessionId as string);
        return ok ? res.status(204).end() : res.status(404).json({ error: "Session not found" });
    }
}

export const agentController = AgentController;