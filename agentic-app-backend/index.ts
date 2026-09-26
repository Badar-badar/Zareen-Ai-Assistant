import express from "express";
import { connectDB } from "./src/config/mongodb.js";
import cors from "cors";
import chatRouter from "./src/routes/chat.route.js";
import customerRouter from "./src/routes/customer.route.js";
import orderRouter from "./src/routes/order.route.js";
import weatherRouter from "./src/routes/weather.route.js";
import mcpRouter from "./src/routes/mcp-server.route.js";
import agentRouter from "./src/routes/agent.route.js";
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/chatWithLlm", chatRouter);
app.use("/api/customers", customerRouter);
app.use("/api/orders", orderRouter);
app.use("/api/weather", weatherRouter);
app.use("/mcp", mcpRouter);
app.use("/api/chat", agentRouter);


// Start the server
const PORT = process.env.PORT || 4200;



async function startServer() {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.log("Error starting the server", error);
        process.exit(1);
    }
}

startServer();