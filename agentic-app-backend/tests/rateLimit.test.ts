import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { userLimiter, loginLimiter } from "../src/middleware/rateLimit.js";

// Pretend auth already ran: whoever sends X-User is that user
const app = express();
app.use((req, _res, next) => { req.user = { id: String(req.headers["x-user"]) }; next(); });
app.post("/chat", userLimiter, (_req, res) => res.json({ ok: true }));
app.post("/login", loginLimiter, (_req, res) => res.json({ ok: true }));

describe("Day 1: rate limits", () => {
  it("allows 10 chats a minute per user, then 429", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await request(app).post("/chat").set("X-User", "rl-a")).status).toBe(200);
    }
    expect((await request(app).post("/chat").set("X-User", "rl-a")).status).toBe(429);
  });

  it("limits are per user: another user is unaffected", async () => {
    expect((await request(app).post("/chat").set("X-User", "rl-b")).status).toBe(200);
  });

  it("limits login attempts to 10 per window, then 429", async () => {
    for (let i = 0; i < 10; i++) {
      expect((await request(app).post("/login")).status).toBe(200);
    }
    expect((await request(app).post("/login")).status).toBe(429);
  });
});