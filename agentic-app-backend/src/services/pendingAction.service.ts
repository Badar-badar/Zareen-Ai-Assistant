import { createHash } from "node:crypto";
import mongoose from "mongoose";
import PendingAction from "../models/pendingAction.model.js";
import CustomerModel from "../models/customer.model.js";
import { createOrder } from "./order.service.js";
import { createCustomer } from "./customer.service.js";
import { ProposeOrderInput, ProposeCustomerInput, ProposeStatusInput } from "../validation/schemas.js";
import { PENDING } from "../config/pending.js";
import UserModel from "../models/user.model.js";
import { can, toRole } from "../mcp/permissions.js";
import OrderModel from "../models/order.model.js";
export interface PendingView {
  id: string;
  type: "createOrder" | "createCustomer" | "updateOrderStatus";
  summary: string;
  expiresAt: string;
}

type ProposeResult = { ok: true; view: PendingView; duplicate: boolean } | { ok: false; error: string };

const short = (s: string, n = 80) => (s.length > n ? s.slice(0, n) + "…" : s);

const fingerprintOf = (userId: string, type: string, payload: unknown) =>
  createHash("sha256").update(JSON.stringify([userId, type, payload])).digest("hex");

const toView = (d: { _id: mongoose.Types.ObjectId; type: string; summary: string; expiresAt: Date }): PendingView => ({
  id: d._id.toString(),
  type: d.type as PendingView["type"],
  summary: d.summary,
  expiresAt: d.expiresAt.toISOString(),
});

// Saves the proposal. Writes NOTHING to the customers or orders collections.
async function savePending(userId: string, type: "createOrder" | "createCustomer" | "updateOrderStatus", payload: object, summary: string): Promise<ProposeResult> {
  const now = new Date();
  const fingerprint = fingerprintOf(userId, type, payload);

  // The same proposal twice (a looping agent, a retry) returns the existing card instead of making another
  const existing = await PendingAction.findOne({ userId, fingerprint, status: "pending", expiresAt: { $gt: now } });
  if (existing) return { ok: true, view: toView(existing), duplicate: true };

  const open = await PendingAction.countDocuments({ userId, status: "pending", expiresAt: { $gt: now } });
  if (open >= PENDING.maxOpenPerUser) {
    return { ok: false, error: "Too many proposals are waiting for confirmation. Ask the user to confirm or cancel them first." };
  }

  const expiresAt = new Date(now.getTime() + PENDING.ttlMs);
  const doc = await PendingAction.create({
    userId, type, payload, summary, fingerprint, expiresAt,
    purgeAt: new Date(expiresAt.getTime() + PENDING.keepAuditMs),
  });
  return { ok: true, view: toView(doc), duplicate: false };
}

export async function proposeOrder(userId: string, raw: unknown): Promise<ProposeResult> {
  const parsed = ProposeOrderInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid order. Need customerId (24-character id) and totalAmount between 0.01 and 1,000,000." };
  const { customerId, totalAmount } = parsed.data;

  const customer = await CustomerModel.findById(customerId).lean();
  if (!customer) return { ok: false, error: "No customer with that id. Look the customer up first and use the id from the result." };

  const summary = `Create order for ${short(customer.name)} (${short(customer.email, 60)}): total ${totalAmount.toFixed(2)}, status pending`;
  return savePending(userId, "createOrder", { customerId, totalAmount }, summary);
}

export async function proposeCustomer(userId: string, raw: unknown): Promise<ProposeResult> {
  const parsed = ProposeCustomerInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid customer. Need name and a valid email; phone is optional." };
  const { name, email, phone } = parsed.data;

  if (await CustomerModel.exists({ email })) return { ok: false, error: "A customer with this email already exists." };

  const summary = `Create customer ${short(name)} <${short(email, 60)}>${phone ? `, phone ${short(phone, 30)}` : ""}`;
  return savePending(userId, "createCustomer", { name, email, ...(phone ? { phone } : {}) }, summary);
}

type Failure = { ok: false; status: 403 | 404 | 409 | 410 | 500; error: string };
export type ActionOutcome =
  | { ok: true; id: string; status: "confirmed" | "cancelled"; resultId?: string; label?: string }
  | Failure;

// Why did the atomic claim fail? 404 (not yours / doesn't exist), 409 (already handled), 410 (expired)
async function explainFailure(userId: string, id: string): Promise<Failure> {
  const doc = await PendingAction.findOne({ _id: id, userId }).lean<{ status: string }>();
  if (!doc) return { ok: false, status: 404, error: "Action not found" };
  if (doc.status !== "pending") return { ok: false, status: 409, error: `This action was already ${doc.status}.` };
  return { ok: false, status: 410, error: "This action has expired. Please ask again." };
}

export async function confirmAction(userId: string, id: string): Promise<ActionOutcome> {
    // Permission is checked against the CURRENT role in the database, not the token.
  const found = await PendingAction.findOne({ _id: id, userId }).select("type").lean<{ type: string }>();
  if (!found) return { ok: false, status: 404, error: "Action not found" };

  const user = await UserModel.findById(userId).select("role").lean<{ role?: string }>();
 const needed = found.type === "createCustomer" ? "customers:propose" : "orders:propose";
  if (!user || !can(toRole(user.role), needed)) {
    return { ok: false, status: 403, error: "You don't have permission to confirm this action." };
  }
  const now = new Date();

  // ONE atomic step: only the first caller can move pending -> confirmed. A double-click gets null.
  const claimed = await PendingAction.findOneAndUpdate(
    { _id: id, userId, status: "pending", expiresAt: { $gt: now } },
    { $set: { status: "confirmed" } },
    { returnDocument: "after" }
  );
  if (!claimed) return explainFailure(userId, id);

  const fail = async (message: string): Promise<Failure> => {
    await PendingAction.updateOne({ _id: claimed._id }, { $set: { status: "failed", error: message } });
    return { ok: false, status: 500, error: message };
  };

  try {
    // Re-validate the STORED payload. Approval does not make bad data good.
    if (claimed.type === "createOrder") {
      const p = ProposeOrderInput.safeParse(claimed.payload);
      if (!p.success) return await fail("Stored order data is invalid.");
      if (!(await CustomerModel.exists({ _id: p.data.customerId }))) return await fail("The customer no longer exists.");

      const order = await createOrder({ customerId: p.data.customerId, totalAmount: p.data.totalAmount, status: "pending" });
      await PendingAction.updateOne({ _id: claimed._id }, { $set: { resultId: order.id, resultLabel: order.orderNumber } });
      return { ok: true, id, status: "confirmed", resultId: order.id, label: order.orderNumber };
    }
         if (claimed.type === "updateOrderStatus") {
      const p = ProposeStatusInput.safeParse(claimed.payload);
      if (!p.success) return await fail("Stored update is invalid.");
      const updated = await OrderModel.findOneAndUpdate(
        { _id: p.data.orderId },
        { $set: { status: p.data.status } },
        { returnDocument: "after" }
      );
      if (!updated) return await fail("The order no longer exists.");
      await PendingAction.updateOne({ _id: claimed._id }, { $set: { resultId: updated.id, resultLabel: updated.orderNumber } });
      return { ok: true, id, status: "confirmed", resultId: updated.id, label: updated.orderNumber };
    }
    
    const p = ProposeCustomerInput.safeParse(claimed.payload);
    if (!p.success) return await fail("Stored customer data is invalid.");
    if (await CustomerModel.exists({ email: p.data.email })) return await fail("A customer with this email already exists.");

    const customer = await createCustomer({ name: p.data.name, email: p.data.email, phone: p.data.phone });
    await PendingAction.updateOne({ _id: claimed._id }, { $set: { resultId: customer.id, resultLabel: customer.name } });
    return { ok: true, id, status: "confirmed", resultId: customer.id, label: customer.name };
  } catch (err) {
    console.error("confirmAction failed", err);
    return await fail("The write failed. Nothing was retried automatically."); // never retry silently
  }
}

export async function cancelAction(userId: string, id: string): Promise<ActionOutcome> {
  const res = await PendingAction.findOneAndUpdate(
    { _id: id, userId, status: "pending" },
    { $set: { status: "cancelled" } },
    { returnDocument: "after" }
  );
  if (!res) return explainFailure(userId, id);
  return { ok: true, id, status: "cancelled" };
}

export async function proposeOrderStatus(userId: string, raw: unknown): Promise<ProposeResult> {
  const parsed = ProposeStatusInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Invalid update. Need orderId (24-character id from an order lookup) and status: pending, completed or cancelled." };
  }
  const { orderId, status } = parsed.data;

  const order = await OrderModel.findById(orderId).lean<{ orderNumber: string; status: string }>();
  if (!order) return { ok: false, error: "No order with that id. Look the order up with getOrderById and use its id." };
  if (order.status === status) return { ok: false, error: `Order ${order.orderNumber} is already ${status}. Nothing to change.` };

  const summary = `Change order ${order.orderNumber} status from ${order.status} to ${status}`;
  return savePending(userId, "updateOrderStatus", { orderId, status }, summary);
}