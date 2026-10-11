import mongoose from "mongoose";
import type { Content } from "@google/genai";
import ChatSession from "../models/chatSession.model.js";
import { SESSION } from "../config/session.js";

export interface StoredMessage {
  role: "user" | "model";
  text: string;
  at: Date;
}

const clip = (s: string) => s.slice(0, SESSION.maxStoredChars);

// Finds a session only if it belongs to this user and hasn't expired. Anything else is "not found".
export async function getSession(userId: string, sessionId: string) {
  if (!mongoose.isValidObjectId(sessionId)) return null;
  return ChatSession.findOne({
    _id: sessionId,
    userId,
    expiresAt: { $gt: new Date() },
  }).lean<{ _id: mongoose.Types.ObjectId; messages: StoredMessage[] }>();
}

export async function startSession(userId: string, userText: string, modelText: string) {
  const now = Date.now();
  const doc = await ChatSession.create({
    userId,
    messages: [
      { role: "user", text: clip(userText), at: new Date(now) },
      { role: "model", text: clip(modelText), at: new Date(now) },
    ],
    expiresAt: new Date(now + SESSION.ttlMs),
  });
  return doc._id.toString();
}

// Adds one exchange atomically, keeps only the newest N messages, and pushes the expiry forward
export async function appendExchange(userId: string, sessionId: string, userText: string, modelText: string) {
  const now = Date.now();
  const res = await ChatSession.updateOne(
    { _id: sessionId, userId, expiresAt: { $gt: new Date(now) } },
    {
      $push: {
        messages: {
          $each: [
            { role: "user", text: clip(userText), at: new Date(now) },
            { role: "model", text: clip(modelText), at: new Date(now) },
          ],
          $slice: -SESSION.maxMessages,
        },
      },
      $set: { expiresAt: new Date(now + SESSION.ttlMs) },
    }
  );
  return res.matchedCount === 1;
}

export async function deleteSession(userId: string, sessionId: string) {
  if (!mongoose.isValidObjectId(sessionId)) return false;
  const res = await ChatSession.deleteOne({ _id: sessionId, userId });
  return res.deletedCount === 1;
}

// Takes the newest messages that fit the budget, dropping the oldest first
export function buildHistory(messages: StoredMessage[], charBudget: number): Content[] {
  const picked: StoredMessage[] = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (used + m.text.length > charBudget) break;
    picked.unshift(m);
    used += m.text.length;
  }
  while (picked.length && picked[0].role !== "user") picked.shift(); // history must begin with a user turn
  return picked.map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
}