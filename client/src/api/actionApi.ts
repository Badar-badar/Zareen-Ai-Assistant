import { getToken, clearToken } from '../auth/token';

const API = import.meta.env.VITE_API_URL;

// verb is "confirm" or "cancel". Returns { ok, status, label?, error? }
async function call(id, verb) {
    try {
        const res = await fetch(`${API}/api/actions/${id}/${verb}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
            clearToken();
            window.location.reload();
            return { ok: false, error: "Session expired. Please sign in again." };
        }
        if (res.status === 429) return { ok: false, error: "Too many requests. Please wait a minute." };
        if (!res.ok) return { ok: false, error: data.error || "Something went wrong." };
        return { ok: true, status: data.status, label: data.label };
    } catch {
        return { ok: false, error: "Couldn't reach the server." };
    }
}

export const confirmAction = (id) => call(id, "confirm");
export const cancelAction = (id) => call(id, "cancel");