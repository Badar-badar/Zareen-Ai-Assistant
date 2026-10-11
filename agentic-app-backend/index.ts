import express from "express";
import cors from "cors";
import { connectDB } from "./src/config/mongodb.js";
import { ipLimiter } from "./src/middleware/rateLimit.js";
import { requireAuth } from "./src/middleware/auth.js";
import authRouter from "./src/routes/auth.route.js";
import chatRouter from "./src/routes/chat.route.js";
import customerRouter from "./src/routes/customer.route.js";
import orderRouter from "./src/routes/order.route.js";
import weatherRouter from "./src/routes/weather.route.js";
import mcpRouter from "./src/routes/mcp-server.route.js";
import agentRouter from "./src/routes/agent.route.js";
import ChatSession from "./src/models/chatSession.model.js";
import User from "./src/models/user.model.js";

const app = express();
app.disable("x-powered-by");

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173")
  .split(",")
  .map((s) => s.trim());

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
    maxAge: 600,
  })
);
app.use(ipLimiter);
app.use("/auth", authRouter);
app.use(requireAuth);
app.use(express.json({ limit: "10kb" }));

app.use("/api/chatWithLlm", chatRouter);
app.use("/api/customers", customerRouter);
app.use("/api/orders", orderRouter);
app.use("/api/weather", weatherRouter);
app.use("/mcp", mcpRouter);
app.use("/api/chat", agentRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status >= 500 ? "Internal server error" : err.message });
});

const PORT = Number(process.env.PORT) || 4200;
const HOST = process.env.HOST ?? "127.0.0.1";

async function startServer() {
  try {
    await connectDB();
    await Promise.all([ChatSession.init(), User.init()]);
    app.listen(PORT, HOST, () => {
      console.log(`Server is running on http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.log("Error starting the server", error);
    process.exit(1);
  }
}

startServer();