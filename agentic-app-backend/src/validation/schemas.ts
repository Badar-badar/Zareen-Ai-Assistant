import { z } from "zod";

export const LoginBody = z
  .object({
    email: z.email().max(254),
    password: z.string().min(1).max(200),
  })
  .strict();

export const ChatBody = z
  .object({
    message: z.string().trim().min(1).max(2000),
    sessionId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  })
  .strict();

export const SessionIdParam = z.object({ sessionId: z.string().regex(/^[a-f\d]{24}$/i) });

export const LimitQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const IdParam = z.object({ id: z.string().trim().min(1).max(254) });

export const CityParam = z.object({
  city: z.string().trim().min(1).max(100).regex(/^[\p{L}\p{M}\s.,'-]+$/u),
});

export const CreateOrderBody = z
  .object({
    customerId: z.string().regex(/^[a-f\d]{24}$/i),
    totalAmount: z.number().positive().max(1_000_000),
    orderNumber: z.string().max(50).optional(),
    orderDate: z.iso.datetime().optional(),
    status: z.enum(["pending", "completed", "cancelled"]).optional(),
  })
  .strict();