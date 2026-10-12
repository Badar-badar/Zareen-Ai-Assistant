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