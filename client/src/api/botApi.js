import { getToken, clearToken } from '../auth/token';

const API = import.meta.env.VITE_API_URL;
let sessionId;

const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
});

const say = (text, actions = []) => ({ text, actions });

// Returns { text, actions }. "actions" are pending proposals waiting for Confirm/Cancel.
export const botApi = async (message) => {
    try {
        const response = await fetch(`${API}/api/chat`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(sessionId ? { message, sessionId } : { message }),
        });
        const data = await response.json().catch(() => ({}));
        if (response.status === 401) {
            clearToken();
            window.location.reload();
            return say("Session expired. Please sign in again.");
        }
        if (response.status === 404) {
            sessionId = undefined;
            return say("That conversation expired. Please ask again.");
        }
        if (response.status === 429) return say("Too many requests. Please wait a minute.");
        if (!response.ok) return say(data.error || "Error response from server.");
        if (data.sessionId) sessionId = data.sessionId;
        return say(data.reply, Array.isArray(data.pendingActions) ? data.pendingActions : []);
    } catch (error) {
        console.error("botApi Error:", error);
        return say("Sorry, I couldn't reach the server. Please check if backend is running.");
    }
};

export const resetSession = () => {
    const id = sessionId;
    sessionId = undefined;
    if (id) fetch(`${API}/api/chat/${id}`, { method: "DELETE", headers: headers() }).catch(() => {});
};

// Streaming version of botApi. Returns { text, actions, aborted }.
export const botStream = async (message, { signal, onDelta, onReset, onReplace } = {}) => {
    let acc = "";
    try {
        const response = await fetch(`${API}/api/chat/stream`, {
            method: "POST",
            headers: headers(),
            body: JSON.stringify(sessionId ? { message, sessionId } : { message }),
            signal,
        });

        if (!response.ok || !response.body) {
            const data = await response.json().catch(() => ({}));
            if (response.status === 401) {
                clearToken();
                window.location.reload();
                return say("Session expired. Please sign in again.");
            }
            if (response.status === 404) {
                sessionId = undefined;
                return say("That conversation expired. Please ask again.");
            }
            if (response.status === 429) return say(data.error || "Too many requests. Please wait a minute.");
            return say(data.error || "Error response from server.");
        }

        let result = null;
        const handle = (block) => {
            let event = "message";
            let data = "";
            for (const line of block.split("\n")) {
                if (line.startsWith("event:")) event = line.slice(6).trim();
                else if (line.startsWith("data:")) data += line.slice(5).trim();
            }
            if (!data) return; // a ": ping" comment
            const d = JSON.parse(data);
            if (event === "delta") { acc += d.text; onDelta?.(d.text); }
            else if (event === "reset") { acc = ""; onReset?.(); }
            else if (event === "replace") { acc = d.text; onReplace?.(d.text); }
            else if (event === "done") {
                if (d.sessionId) sessionId = d.sessionId;
                result = say(d.reply, Array.isArray(d.pendingActions) ? d.pendingActions : []);
            } else if (event === "error") result = say(d.message || "Something went wrong.");
        };

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let i;
            while ((i = buf.indexOf("\n\n")) !== -1) {
                handle(buf.slice(0, i));
                buf = buf.slice(i + 2);
            }
        }
        return result ?? say(acc || "The connection closed before the reply finished.");
    } catch (error) {
        if (error?.name === "AbortError") return { text: acc, actions: [], aborted: true };
        console.error("botStream Error:", error);
        return say(acc || "Sorry, I couldn't reach the server. Please check if backend is running.");
    }
};