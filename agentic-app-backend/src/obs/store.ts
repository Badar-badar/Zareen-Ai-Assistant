import mongoose from "mongoose";
import TraceModel from "../models/trace.model.js";
import { timeline, type TraceRecord } from "./trace.js";

const KEEP_DAYS = Number(process.env.TRACE_KEEP_DAYS || 14);
const DAILY_LIMIT_USD = Number(process.env.USER_DAILY_COST_LIMIT_USD || 0); // 0 = no limit

export async function saveTrace(t: TraceRecord) {
  if (process.env.TRACE_CONSOLE === "true") console.log(timeline(t));
  if (mongoose.connection.readyState !== 1) return; // not connected (tests, eval)
  try {
    await TraceModel.create({ ...t, expiresAt: new Date(Date.now() + KEEP_DAYS * 86_400_000) });
  } catch (e) {
    console.error("saveTrace failed", (e as Error).message); // tracing must never break a request
  }
}

export async function spentToday(userId: string): Promise<number> {
  if (mongoose.connection.readyState !== 1) return 0;
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const r = await TraceModel.aggregate([
    { $match: { userId, startedAt: { $gte: since } } },
    { $group: { _id: null, total: { $sum: "$costUsd" } } },
  ]);
  return r[0]?.total ?? 0;
}

export async function overDailyLimit(userId: string): Promise<boolean> {
  return DAILY_LIMIT_USD > 0 && (await spentToday(userId)) >= DAILY_LIMIT_USD;
}