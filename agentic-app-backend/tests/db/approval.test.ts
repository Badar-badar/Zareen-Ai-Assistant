import { describe, it, expect, beforeEach } from "vitest";
import CustomerModel from "../../src/models/customer.model.js";
import OrderModel from "../../src/models/order.model.js";
import PendingAction from "../../src/models/pendingAction.model.js";
import UserModel from "../../src/models/user.model.js";
import {
  proposeOrder, proposeCustomer, proposeOrderStatus, confirmAction, cancelAction,
} from "../../src/services/pendingAction.service.js";
import { PENDING } from "../../src/config/pending.js";
import { hasDb, useTestDb, makeCustomer, makeUser } from "./dbHelper.js";

const orders = () => OrderModel.countDocuments();
const customers = () => CustomerModel.countDocuments();

async function proposeOk(userId: string, customerId: string, amount: number) {
  const r = await proposeOrder(userId, { customerId, totalAmount: amount });
  if (!r.ok) throw new Error(r.error);
  return r.view;
}

describe.skipIf(!hasDb)("Day 4: nothing is written until the user confirms (real database)", () => {
  useTestDb();

  let alice = "";
  let bob = "";
  beforeEach(async () => {
    alice = await makeUser("staff");
    bob = await makeUser("staff");
  });
  it("DONE-WHEN: proposing an order writes NOTHING to orders", async () => {
    const cid = await makeCustomer();
    const view = await proposeOk(alice, cid, 250);
    expect(await orders()).toBe(0);
    expect(view.summary).toContain("Bilal Khan");
    expect(view.summary).toContain("250.00");
    expect(await PendingAction.countDocuments({ status: "pending" })).toBe(1);
  });

  it("DONE-WHEN: proposing a customer writes NOTHING to customers", async () => {
    const r = await proposeCustomer(alice, { name: "Ali", email: "ali@example.com" });
    expect(r.ok).toBe(true);
    expect(await customers()).toBe(0);
  });

  it("confirm creates exactly one order, with the stored data", async () => {
    const cid = await makeCustomer();
    const view = await proposeOk(alice, cid, 250);
    const out = await confirmAction(alice, view.id);
    expect(out.ok).toBe(true);
    expect(await orders()).toBe(1);
    const o = await OrderModel.findOne().lean<{ totalAmount: number; customerId: string; status: string }>();
    expect(o).toMatchObject({ totalAmount: 250, customerId: cid, status: "pending" });
  });

  it("confirm creates the customer", async () => {
    const r = await proposeCustomer(alice, { name: "Ali", email: "ALI@example.com" });
    if (!r.ok) throw new Error(r.error);
    expect((await confirmAction(alice, r.view.id)).ok).toBe(true);
    expect(await customers()).toBe(1);
    expect((await CustomerModel.findOne().lean<{ email: string }>())!.email).toBe("ali@example.com");
  });

  it("status changes are proposed first and applied only after confirmation", async () => {
    const order = await OrderModel.create({
      customerId: await makeCustomer(),
      orderNumber: "ORD-STATUS-1",
      totalAmount: 25,
      status: "pending",
    });
    const proposal = await proposeOrderStatus(alice, { orderId: order.id, status: "completed" });
    if (!proposal.ok) throw new Error(proposal.error);
    expect(proposal.view.type).toBe("updateOrderStatus");
    expect((await OrderModel.findById(order.id).lean())?.status).toBe("pending");

    expect((await confirmAction(alice, proposal.view.id)).ok).toBe(true);
    expect((await OrderModel.findById(order.id).lean())?.status).toBe("completed");
  });

  it("does not apply a status proposal if the order changed before confirmation", async () => {
    const order = await OrderModel.create({
      customerId: await makeCustomer(),
      orderNumber: "ORD-STATUS-2",
      totalAmount: 25,
      status: "pending",
    });
    const proposal = await proposeOrderStatus(alice, { orderId: order.id, status: "completed" });
    if (!proposal.ok) throw new Error(proposal.error);
    await OrderModel.updateOne({ _id: order.id }, { $set: { status: "cancelled" } });

    expect(await confirmAction(alice, proposal.view.id)).toMatchObject({ ok: false, status: 500 });
    expect((await OrderModel.findById(order.id).lean())?.status).toBe("cancelled");
  });

  it("DONE-WHEN: confirming twice creates only one order", async () => {
    const view = await proposeOk(alice, await makeCustomer(), 10);
    const first = await confirmAction(alice, view.id);
    const second = await confirmAction(alice, view.id);
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: false, status: 409 });
    expect(await orders()).toBe(1);
  });

  it("a double-click (many confirms at the SAME instant) still creates only one order", async () => {
    const view = await proposeOk(alice, await makeCustomer(), 10);
    const results = await Promise.all(Array.from({ length: 8 }, () => confirmAction(alice, view.id)));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(await orders()).toBe(1);
  });

  it("DONE-WHEN: cancelling writes nothing, and a cancelled action cannot be confirmed", async () => {
    const view = await proposeOk(alice, await makeCustomer(), 10);
    expect((await cancelAction(alice, view.id)).ok).toBe(true);
    expect(await orders()).toBe(0);
    expect(await confirmAction(alice, view.id)).toMatchObject({ ok: false, status: 409 });
    expect(await orders()).toBe(0);
  });

  it("DONE-WHEN: another user cannot confirm or cancel my action (404)", async () => {
    const view = await proposeOk(alice, await makeCustomer(), 10);
    expect(await confirmAction(bob, view.id)).toMatchObject({ ok: false, status: 404 });
    expect(await cancelAction(bob, view.id)).toMatchObject({ ok: false, status: 404 });
    expect(await orders()).toBe(0);
    expect((await PendingAction.findById(view.id).lean<{ status: string }>())!.status).toBe("pending"); // untouched
  });

  it("DONE-WHEN: an expired action cannot be confirmed (410)", async () => {
    const view = await proposeOk(alice, await makeCustomer(), 10);
    await PendingAction.updateOne({ _id: view.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await confirmAction(alice, view.id)).toMatchObject({ ok: false, status: 410 });
    expect(await orders()).toBe(0);
  });

  it("an unknown action id is 404", async () => {
    expect(await confirmAction(alice, "b".repeat(24))).toMatchObject({ ok: false, status: 404 });
  });

  it("re-checks at confirm time: if the customer was deleted meanwhile, nothing is created", async () => {
    const cid = await makeCustomer();
    const view = await proposeOk(alice, cid, 10);
    await CustomerModel.deleteOne({ _id: cid });
    expect(await confirmAction(alice, view.id)).toMatchObject({ ok: false, status: 500 });
    expect(await orders()).toBe(0);
    expect((await PendingAction.findById(view.id).lean<{ status: string }>())!.status).toBe("failed");
  });

  it("re-checks at confirm time: a customer email taken meanwhile is refused", async () => {
    const r = await proposeCustomer(alice, { name: "Ali", email: "ali@example.com" });
    if (!r.ok) throw new Error(r.error);
    await CustomerModel.create({ name: "Someone", email: "ali@example.com" });
    expect((await confirmAction(alice, r.view.id)).ok).toBe(false);
    expect(await customers()).toBe(1);
  });

  it("cannot propose an order for a customer that does not exist", async () => {
    const r = await proposeOrder(alice, { customerId: "c".repeat(24), totalAmount: 5 });
    expect(r.ok).toBe(false);
    expect(await PendingAction.countDocuments()).toBe(0);
  });

  it("cannot propose a customer whose email already exists", async () => {
    await makeCustomer("Bilal", "bilal@example.com");
    const r = await proposeCustomer(alice, { name: "Bilal 2", email: "bilal@example.com" });
    expect(r.ok).toBe(false);
  });

  it("rejects invalid proposals (bad amount) without saving anything", async () => {
    const cid = await makeCustomer();
    for (const amount of [0, -1, 5_000_000]) {
      expect((await proposeOrder(alice, { customerId: cid, totalAmount: amount })).ok).toBe(false);
    }
    expect(await PendingAction.countDocuments()).toBe(0);
  });

  it("the same proposal twice returns the same card, not a second one", async () => {
    const cid = await makeCustomer();
    const a = await proposeOk(alice, cid, 10);
    const b = await proposeOk(alice, cid, 10);
    expect(b.id).toBe(a.id);
    expect(await PendingAction.countDocuments()).toBe(1);
  });

  it("limits how many proposals a user can leave waiting", async () => {
    const cid = await makeCustomer();
    for (let i = 1; i <= PENDING.maxOpenPerUser; i++) await proposeOk(alice, cid, i);
    const extra = await proposeOrder(alice, { customerId: cid, totalAmount: 999 });
    expect(extra.ok).toBe(false);
    // another user is not affected
    expect((await proposeOrder(bob, { customerId: cid, totalAmount: 999 })).ok).toBe(true);
  });

  it("the stored card text is built from the stored data, not from anything the model says", async () => {
    const cid = await makeCustomer("Bilal Khan", "bilal@example.com");
    const view = await proposeOk(alice, cid, 2500);
    expect(view.summary).toContain("2500.00");
    const doc = await PendingAction.findById(view.id).lean<{ payload: { totalAmount: number } }>();
    expect(doc!.payload.totalAmount).toBe(2500);
  });

  it("keeps an audit record after confirm, with the created order's id", async () => {
    const view = await proposeOk(alice, await makeCustomer(), 10);
    await confirmAction(alice, view.id);
    const doc = await PendingAction.findById(view.id).lean<{ status: string; resultId: string; userId: string }>();
    expect(doc).toMatchObject({ status: "confirmed", userId: alice });
    expect(doc!.resultId).toBeTruthy();
  });

    it("DONE-WHEN: a viewer cannot confirm (403), and nothing is written", async () => {
    const viewer = await makeUser("viewer");
    const view = await proposeOk(viewer, await makeCustomer(), 10);
    expect(await confirmAction(viewer, view.id)).toMatchObject({ ok: false, status: 403 });
    expect(await orders()).toBe(0);
    expect((await PendingAction.findById(view.id).lean<{ status: string }>())!.status).toBe("pending");
  });

  it("DONE-WHEN: a staff user can confirm, and exactly one order exists", async () => {
    const view = await proposeOk(alice, await makeCustomer(), 10);
    expect((await confirmAction(alice, view.id)).ok).toBe(true);
    expect(await orders()).toBe(1);
  });

  it("a user demoted after proposing cannot confirm (the role is read from the database)", async () => {
    const view = await proposeOk(alice, await makeCustomer(), 10);
    await UserModel.updateOne({ _id: alice }, { $set: { role: "viewer" } });
    expect(await confirmAction(alice, view.id)).toMatchObject({ ok: false, status: 403 });
    expect(await orders()).toBe(0);
  });

});