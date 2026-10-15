import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { makeToken } from "./helpers/tokens.js";

const app = createApp();

// DONE-WHEN for Day 1: every route returns 401 without a token
const ROUTES: [string, string][] = [
  ["get", "/api/customers"],
  ["get", "/api/customers/abc"],
  ["get", "/api/orders"],
  ["get", "/api/orders/abc"],
  ["post", "/api/orders"],
  ["get", "/api/weather/London"],
  ["post", "/api/chat"],
  ["delete", "/api/chat/507f1f77bcf86cd799439011"],
  ["post", "/api/chatWithLlm"],
  ["post", "/api/actions/507f1f77bcf86cd799439011/confirm"],
  ["post", "/api/actions/507f1f77bcf86cd799439011/cancel"],
  ["post", "/mcp"],
  ["get", "/mcp"],
  ["delete", "/mcp"],
  ["get", "/does-not-exist"], // proves "deny by default": even unknown paths need a token
  ["put", "/api/customers/abc"],
];

describe("Day 1: every route returns 401 without a token", () => {
  it.each(ROUTES)("%s %s", async (method, path) => {
    const res = await (request(app) as any)[method](path).send({});
    expect(res.status).toBe(401);
  });

  it.each(ROUTES)("%s %s with a bad token", async (method, path) => {
    const res = await (request(app) as any)[method](path).set("Authorization", "Bearer garbage").send({});
    expect(res.status).toBe(401);
  });
});

describe("Day 1: with a valid token, validation runs before any database work", () => {
  const auth = async () => ({ Authorization: `Bearer ${await makeToken({ sub: "valid-user-1" })}` });

  it("rejects an absurd ?limit", async () => {
    const res = await request(app).get("/api/customers?limit=100000").set(await auth());
    expect(res.status).toBe(400);
  });

  it("rejects a non-numeric ?limit", async () => {
    expect((await request(app).get("/api/orders?limit=abc").set(await auth())).status).toBe(400);
  });

  it("rejects an empty chat message", async () => {
    expect((await request(app).post("/api/chat").set(await auth()).send({ message: "  " })).status).toBe(400);
  });

  it("rejects an oversized chat message", async () => {
    expect((await request(app).post("/api/chat").set(await auth()).send({ message: "x".repeat(2001) })).status).toBe(400);
  });

  it("rejects unknown fields in a chat body", async () => {
    const res = await request(app).post("/api/chat").set(await auth()).send({ message: "hi", prompt: "extra" });
    expect(res.status).toBe(400);
  });

  it("rejects a malformed sessionId", async () => {
    const res = await request(app).post("/api/chat").set(await auth()).send({ message: "hi", sessionId: "not-an-id" });
    expect(res.status).toBe(400);
  });

  it("rejects a negative order amount", async () => {
    const res = await request(app).post("/api/orders").set(await auth()).send({ customerId: "a".repeat(24), totalAmount: -5 });
    expect(res.status).toBe(400);
  });

  it("rejects a weather city that is not a plain name", async () => {
    expect((await request(app).get("/api/weather/<script>").set(await auth())).status).toBe(400);
  });

  it("rejects a malformed action id", async () => {
    expect((await request(app).post("/api/actions/not-an-id/confirm").set(await auth())).status).toBe(400);
  });

  it("rejects a NoSQL-injection style login body", async () => {
    const res = await request(app).post("/auth/login").send({ email: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });
});

describe("Day 1: CORS", () => {
  it("answers the browser preflight from the allowed origin without a token", async () => {
    const res = await request(app)
      .options("/api/chat")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("does not allow another website's origin", async () => {
    const res = await request(app).get("/api/customers").set("Origin", "https://evil.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("does not advertise the framework", async () => {
    const res = await request(app).get("/api/customers");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});