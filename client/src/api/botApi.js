export const botApi = async (message) => {
    try {
        const response = await fetch("http://localhost:4200/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ prompt: message, message }),
        });
        const data = await response.json();
        if (!response.ok) {
            return data.error || "Error response from server.";
        }
        return data.reply;
    } catch (error) {
        console.error("botApi Error:", error);
        return "Sorry, I couldn't reach the server. Please check if backend is running.";
    }
}