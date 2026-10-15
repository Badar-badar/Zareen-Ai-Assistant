import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "../src/utils/password.js";
import { buildHistory, type StoredMessage } from "../src/services/session.service.js";
import {
  ChatBody, LimitQuery, ProposeOrderInput, ProposeCustomerInput, CreateOrderBody, LoginBody,
} from "../src/validation/schemas.js";

const id = "a".repeat(24);
const msg = (role: "user" | "model", text: string): StoredMessage => ({ role, text, at: new Date() });

describe("passwords", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const h = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });

  it("never stores the password itself, and salts each hash", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toContain("same-password");
    expect(a).not.toBe(b);
  });

  it("rejects a malformed stored hash instead of crashing", async () => {
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("Day 3: buildHistory keeps the newest messages that fit", () => {
  const msgs = [msg("user", "aaaa"), msg("model", "bbbb"), msg("user", "cccc"), msg("model", "dddd")];

  it("keeps everything when it fits", () => {
    expect(buildHistory(msgs, 100)).toHaveLength(4);
  });

  it("drops the OLDEST first", () => {
    const h = buildHistory(msgs, 8);
    expect(h.map((c) => c.parts![0].text)).toEqual(["cccc", "dddd"]);
  });

  it("never starts with a model message", () => {
    const h = buildHistory(msgs, 12); // would keep bbbb, cccc, dddd
    expect(h[0].role).toBe("user");
  });

  it("returns nothing when even one message is too big", () => {
    expect(buildHistory(msgs, 2)).toEqual([]);
  });

  it("handles an empty session", () => {
    expect(buildHistory([], 100)).toEqual([]);
  });
});

describe("Day 1: input rules", () => {
  it("chat: trims, requires text, allows an optional sessionId, forbids extras", () => {
    expect(ChatBody.parse({ message: "  hi  " }).message).toBe("hi");
    expect(ChatBody.safeParse({ message: "" }).success).toBe(false);
    expect(ChatBody.safeParse({ message: "hi", sessionId: id }).success).toBe(true);
    expect(ChatBody.safeParse({ message: "hi", admin: true }).success).toBe(false);
  });

  it("limit: 1 to 100 whole numbers, strings coerced", () => {
    expect(LimitQuery.parse({ limit: "5" }).limit).toBe(5);
    for (const bad of ["0", "101", "1.5", "-1", "abc"]) expect(LimitQuery.safeParse({ limit: bad }).success).toBe(false);
  });

  it("login: needs a real email and string password", () => {
    expect(LoginBody.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(LoginBody.safeParse({ email: "nope", password: "x" }).success).toBe(false);
    expect(LoginBody.safeParse({ email: "a@b.co", password: { $ne: 1 } }).success).toBe(false);
  });

  it("order body: positive capped amount, valid customer id, no extras", () => {
    expect(CreateOrderBody.safeParse({ customerId: id, totalAmount: 10 }).success).toBe(true);
    expect(CreateOrderBody.safeParse({ customerId: id, totalAmount: 0 }).success).toBe(false);
    expect(CreateOrderBody.safeParse({ customerId: id, totalAmount: 1_000_001 }).success).toBe(false);
    expect(CreateOrderBody.safeParse({ customerId: "x", totalAmount: 10 }).success).toBe(false);
  });
});

describe("Day 4: what the agent may propose (least privilege)", () => {
  it("order: rounds to cents, enforces the cap and minimum", () => {
    expect(ProposeOrderInput.parse({ customerId: id, totalAmount: 250.456 }).totalAmount).toBe(250.46);
    for (const amount of [0.004, -5, 2_000_000]) {
      expect(ProposeOrderInput.safeParse({ customerId: id, totalAmount: amount }).success).toBe(false);
    }
  });

  it("order: the agent cannot choose status, order number or date", () => {
    for (const extra of [{ status: "completed" }, { orderNumber: "X" }, { orderDate: "2020-01-01" }]) {
      expect(ProposeOrderInput.safeParse({ customerId: id, totalAmount: 5, ...extra }).success).toBe(false);
    }
  });

  it("customer: lowercases email, rejects bad email and extras", () => {
    expect(ProposeCustomerInput.parse({ name: " Ali ", email: "ALI@Example.com" })).toEqual({ name: "Ali", email: "ali@example.com" });
    expect(ProposeCustomerInput.safeParse({ name: "Ali", email: "nope" }).success).toBe(false);
    expect(ProposeCustomerInput.safeParse({ name: "Ali", email: "a@b.co", status: "active" }).success).toBe(false);
  });
});