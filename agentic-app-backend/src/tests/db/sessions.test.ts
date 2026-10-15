import { describe, it, expect } from "vitest";
import ChatSession from "../../src/models/chatSession.model.js";
import {
  startSession, getSession, appendExchange, deleteSession,
} from "../../src/services/session.service.js";
import { SESSION } from "../../src/config/session.js";
import { hasDb, useTestDb } from "./dbHelper.js";

describe.skipIf(!hasDb)("Day 3: chat sessions (real database)", () => {
  useTestDb();

  it("saves a session and reads it back for its owner", async () => {
    const id = await startSession("alice", "show orders", "ORD-1 $5");
    const s = await getSession("alice", id);
    expect(s?.messages.map((m) => m.text)).toEqual(["show orders", "ORD-1 $5"]);
  });

  it("DONE-WHEN: another user cannot read my session (looks like 'not found')", async () => {
    const id = await startSession("alice", "private question", "private answer");
    expect(await getSession("bob", id)).toBeNull();
  });

  it("another user cannot add to my session", async () => {
    const id = await startSession("alice", "q", "a");
    expect(await appendExchange("bob", id, "hacked", "hacked")).toBe(false);
    expect((await getSession("alice", id))?.messages).toHaveLength(2);
  });

  it("another user cannot delete my session", async () => {
    const id = await startSession("alice", "q", "a");
    expect(await deleteSession("bob", id)).toBe(false);
    expect(await getSession("alice", id)).not.toBeNull();
    expect(await deleteSession("alice", id)).toBe(true);
    expect(await getSession("alice", id)).toBeNull();
  });

  it("appending keeps order and adds both messages", async () => {
    const id = await startSession("alice", "q1", "a1");
    expect(await appendExchange("alice", id, "q2", "a2")).toBe(true);
    const s = await getSession("alice", id);
    expect(s?.messages.map((m) => m.text)).toEqual(["q1", "a1", "q2", "a2"]);
  });

  it("an expired session is treated as not found, and cannot be appended to", async () => {
    const id = await startSession("alice", "q", "a");
    await ChatSession.updateOne({ _id: id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await getSession("alice", id)).toBeNull();
    expect(await appendExchange("alice", id, "q", "a")).toBe(false);
  });

  it("each new message pushes the expiry forward", async () => {
    const id = await startSession("alice", "q", "a");
    await ChatSession.updateOne({ _id: id }, { $set: { expiresAt: new Date(Date.now() + 60_000) } });
    await appendExchange("alice", id, "q2", "a2");
    const doc = await ChatSession.findById(id).lean<{ expiresAt: Date }>();
    expect(doc!.expiresAt.getTime()).toBeGreaterThan(Date.now() + SESSION.ttlMs - 5_000);
  });

  it("keeps at most maxMessages, dropping the oldest", async () => {
    const id = await startSession("alice", "first", "first-a");
    const rounds = Math.ceil(SESSION.maxMessages / 2) + 3;
    for (let i = 0; i < rounds; i++) await appendExchange("alice", id, `q${i}`, `a${i}`);
    const s = await getSession("alice", id);
    expect(s!.messages.length).toBe(SESSION.maxMessages);
    expect(s!.messages.some((m) => m.text === "first")).toBe(false);
    expect(s!.messages.at(-1)!.text).toBe(`a${rounds - 1}`);
  });

  it("a malformed id is simply not found", async () => {
    expect(await getSession("alice", "not-an-id")).toBeNull();
    expect(await deleteSession("alice", "not-an-id")).toBe(false);
  });

  it("clips very long messages before storing", async () => {
    const id = await startSession("alice", "x".repeat(SESSION.maxStoredChars + 500), "ok");
    const s = await getSession("alice", id);
    expect(s!.messages[0].text.length).toBe(SESSION.maxStoredChars);
  });

  it("has the automatic-expiry index", async () => {
    const idx = await ChatSession.collection.indexes();
    const ttl = idx.find((i) => i.key && (i.key as any).expiresAt === 1);
    expect(ttl?.expireAfterSeconds).toBe(0);
  });
});