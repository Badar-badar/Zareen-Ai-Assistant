import { getToken, clearToken } from '../auth/token';

const API = import.meta.env.VITE_API_URL;
let sessionId;

const headers = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${getToken()}`,
});

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
            return "Session expired. Please sign in again.";
        }
        if (response.status === 404) {
            sessionId = undefined;
            return "That conversation expired. Please ask again.";
        }
        if (response.status === 429) return "Too many requests. Please wait a minute.";
        if (!response.ok) return data.error || "Error response from server.";
        if (data.sessionId) sessionId = data.sessionId;
        return data.reply;
    } catch (error) {
        console.error("botApi Error:", error);
        return "Sorry, I couldn't reach the server. Please check if backend is running.";
    }
};

// "New chat": forget the session locally and delete it on the server
export const resetSession = () => {
    const id = sessionId;
    sessionId = undefined;
    if (id) fetch(`${API}/api/chat/${id}`, { method: "DELETE", headers: headers() }).catch(() => {});
};