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


  export const ObjectIdParam = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) });

// What the AGENT may propose. Deliberately smaller than CreateOrderBody (least privilege):
// no status, no order number, no date. The server fills those in.
export const ProposeOrderInput = z
  .object({
    customerId: z.string().regex(/^[a-f\d]{24}$/i),
    totalAmount: z.number().min(0.01).max(1_000_000).transform((n) => Math.round(n * 100) / 100),
  })
  .strict();

export const ProposeCustomerInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: z.email().max(254).toLowerCase(),
    phone: z.string().trim().max(30).optional(),
  })
  .strict();

  export const ORDER_STATUSES = ["pending", "completed", "cancelled"] as const;

export const ProposeStatusInput = z
  .object({
    orderId: z.string().regex(/^[a-f\d]{24}$/i),
    status: z.enum(ORDER_STATUSES),
  })
  .strict();