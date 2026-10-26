import express from "express";
import cors from "cors";
import { ipLimiter } from "./middleware/rateLimit.js";
import { requireAuth } from "./middleware/auth.js";
import authRouter from "./routes/auth.route.js";
import chatRouter from "./routes/chat.route.js";
import customerRouter from "./routes/customer.route.js";
import orderRouter from "./routes/order.route.js";
import weatherRouter from "./routes/weather.route.js";
import agentRouter from "./routes/agent.route.js";
import actionRouter from "./routes/action.route.js";
import workflowRouter from "./routes/workflow.route.js";
import schedulerRouter from "./routes/scheduler.route.js";
export function createApp() {
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
  app.use("/api/chat", agentRouter);
  app.use("/api/actions", actionRouter);
  app.use("/api/workflows", workflowRouter);
    app.use("/api/scheduler", schedulerRouter);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.status ?? 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? "Internal server error" : err.message });
  });

  return app;
}