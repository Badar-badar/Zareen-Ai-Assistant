import { rateLimit } from "express-rate-limit";

const base = { standardHeaders: "draft-7", legacyHeaders: false } as const;

export const ipLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 100 });

export const loginLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 10 });

export const userLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 10,
  keyGenerator: (req) => req.user!.id,
});

export const actionLimiter = rateLimit({
  ...base,
  windowMs: 60_000,
  limit: 20,
  keyGenerator: (req) => req.user!.id,
});