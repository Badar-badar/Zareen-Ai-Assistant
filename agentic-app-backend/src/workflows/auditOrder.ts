import mongoose from "mongoose";
import OrderModel from "../models/order.model.js";
import CustomerModel from "../models/customer.model.js";
import { proposeOrderStatus } from "../services/pendingAction.service.js";
import { WORKFLOWS } from "../services/workflow.service.js";

// Lets you kill the server between steps when testing. 0 in normal use.
const pause = () => new Promise((r) => setTimeout(r, Number(process.env.WORKFLOW_STEP_DELAY_MS || 0)));

// Every step only reads data or makes a proposal (deduplicated), so running one twice is harmless.
WORKFLOWS.auditPendingOrders = {
  steps: [
    {
      name: "fetchPending",
      run: async () => {
        await pause();
        const rows: any[] = await OrderModel.find({ status: "pending" }).sort({ createdAt: 1 }).limit(200).lean();
        return rows.map((o) => ({
          id: String(o._id),
          orderNumber: o.orderNumber,
          customerId: String(o.customerId),
          totalAmount: o.totalAmount,
          date: new Date(o.orderDate ?? o.createdAt).toISOString(),
        }));
      },
    },
    {
      name: "flagOld",
      run: async (ctx) => {
        await pause();
        const days = Number(ctx.params?.olderThanDays ?? 30);
        const cutoff = Date.now() - days * 86_400_000;
        const all = ctx.outputs.fetchPending as { id: string; date: string }[];
        return all.filter((o) => new Date(o.date).getTime() < cutoff).slice(0, 20);
      },
    },
    {
      name: "lookupCustomers",
      run: async (ctx) => {
        await pause();
        const flagged = ctx.outputs.flagOld as { customerId: string }[];
        const ids = [...new Set(flagged.map((o) => o.customerId))].filter((x) => mongoose.isValidObjectId(x));
        const rows: any[] = ids.length ? await CustomerModel.find({ _id: { $in: ids } }).lean() : [];
        return Object.fromEntries(rows.map((c) => [String(c._id), c.name]));
      },
    },
    {
      name: "proposeCancellations",
      run: async (ctx) => {
        await pause();
        const flagged = ctx.outputs.flagOld as { id: string }[];
        const pending: { id: string; summary: string }[] = [];
        let skipped = 0;
        for (const o of flagged) {
          const r = await proposeOrderStatus(ctx.userId, { orderId: o.id, status: "cancelled" });
          if (r.ok) pending.push({ id: r.view.id, summary: r.view.summary });
          else {
            skipped++;
            if (r.error.startsWith("Too many")) break; // the per-user limit on waiting proposals
          }
        }
        return { pending, skipped };
      },
    },
    {
      name: "buildReport",
      run: async (ctx) => {
        await pause();
        const all = ctx.outputs.fetchPending as unknown[];
        const flagged = ctx.outputs.flagOld as { orderNumber: string; customerId: string; totalAmount: number }[];
        const names = ctx.outputs.lookupCustomers as Record<string, string>;
        const prop = ctx.outputs.proposeCancellations as { pending: { id: string; summary: string }[]; skipped: number };
        const lines = flagged.map((o) => `${o.orderNumber} (${names[o.customerId] ?? "unknown customer"}): ${o.totalAmount}`);
        return {
          text:
            `Pending orders: ${all.length}. Older than ${ctx.params?.olderThanDays ?? 30} days: ${flagged.length}.\n` +
            (lines.length ? lines.join("\n") + "\n" : "") +
            `Cancellation proposals waiting for confirmation: ${prop.pending.length} (not created: ${prop.skipped}).`,
          pending: prop.pending, // confirm with POST /api/actions/:id/confirm
        };
      },
    },
  ],
};