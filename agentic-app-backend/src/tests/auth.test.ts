import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { requireAuth } from "../src/middleware/auth.js";
import { makeToken, unsignedToken } from "./helpers/tokens.js";

// A tiny app: one protected route that echoes who the token says you are
const app = express();
app.get("/whoami", requireAuth, (req, res) => res.json({ user: req.user }));

describe("Day 1: requireAuth", () => {
  it("accepts a valid token and exposes the user id", async () => {
    const t = await makeToken({ sub: "user-1" });
    const res = await request(app).get("/whoami").set("Authorization", `Bearer ${t}`);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe("user-1");
  });

  it("401 with no Authorization header", async () => {
    expect((await request(app).get("/whoami")).status).toBe(401);
  });

  it("401 when the scheme is not Bearer", async () => {
    const t = await makeToken();
    expect((await request(app).get("/whoami").set("Authorization", `Basic ${t}`)).status).toBe(401);
  });

  it("401 for garbage", async () => {
    expect((await request(app).get("/whoami").set("Authorization", "Bearer not-a-jwt")).status).toBe(401);
  });

  it("401 for a tampered token", async () => {
    const t = await makeToken();
    expect((await request(app).get("/whoami").set("Authorization", `Bearer ${t}x`)).status).toBe(401);
  });

  it("401 for a token signed with the wrong secret", async () => {
    const t = await makeToken({ secret: "another-secret-another-secret-another-1" });
    expect((await request(app).get("/whoami").set("Authorization", `Bearer ${t}`)).status).toBe(401);
  });

  it("401 for an expired token", async () => {
    const t = await makeToken({ expiresIn: Math.floor(Date.now() / 1000) - 60 });
    expect((await request(app).get("/whoami").set("Authorization", `Bearer ${t}`)).status).toBe(401);
  });

  it("401 for the wrong audience (a token made for another API)", async () => {
    const t = await makeToken({ audience: "some-other-api" });
    expect((await request(app).get("/whoami").set("Authorization", `Bearer ${t}`)).status).toBe(401);
  });

  it("401 for the wrong issuer", async () => {
    const t = await makeToken({ issuer: "someone-else" });
    expect((await request(app).get("/whoami").set("Authorization", `Bearer ${t}`)).status).toBe(401);
  });

  it('401 for an unsigned "alg: none" token', async () => {
    expect((await request(app).get("/whoami").set("Authorization", `Bearer ${unsignedToken()}`)).status).toBe(401);
  });

  it("401 for a different signing algorithm than the one we pin", async () => {
    const t = await makeToken({ alg: "HS512" });
    expect((await request(app).get("/whoami").set("Authorization", `Bearer ${t}`)).status).toBe(401);
  });

  it("401 for a valid signature but no subject (no user identity)", async () => {
    const t = await makeToken({ sub: undefined });
    expect((await request(app).get("/whoami").set("Authorization", `Bearer ${t}`)).status).toBe(401);
  });

  it("the 401 body never reveals why", async () => {
    const res = await request(app).get("/whoami").set("Authorization", "Bearer nope");
    expect(res.body).toEqual({ error: "Unauthorized" });
    expect(res.headers["www-authenticate"]).toMatch(/Bearer/);
  });
});