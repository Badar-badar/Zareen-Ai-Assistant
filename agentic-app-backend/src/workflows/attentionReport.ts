import mongoose from "mongoose";
import OrderModel from "../models/order.model.js";
import CustomerModel from "../models/customer.model.js";
import { WORKFLOWS } from "../services/workflow.service.js";

WORKFLOWS.dailyAttentionReport = {
  steps: [
    {
      name: "fetchPending",
      run: async (ctx) => {
        if (ctx.params?.forceFail) throw new Error("forced failure (test)"); // proves the alert works
        const rows: any[] = await OrderModel.find({ status: "pending" }).sort({ createdAt: 1 }).limit(200).lean();
        return rows.map((o) => ({
          orderNumber: o.orderNumber,
          customerId: String(o.customerId),
          totalAmount: o.totalAmount,
          date: new Date(o.orderDate ?? o.createdAt).toISOString(),
        }));
      },
    },
    {
      name: "findAttention",
      run: async (ctx) => {
        const days = Number(process.env.ATTENTION_DAYS ?? 7);
        const cutoff = Date.now() - days * 86_400_000;
        const all = ctx.outputs.fetchPending as { date: string }[];
        return all.filter((o) => new Date(o.date).getTime() <= cutoff).slice(0, 50);
      },
    },
    {
      name: "lookupCustomers",
      run: async (ctx) => {
        const flagged = ctx.outputs.findAttention as { customerId: string }[];
        const ids = [...new Set(flagged.map((o) => o.customerId))].filter((x) => mongoose.isValidObjectId(x));
        const rows: any[] = ids.length ? await CustomerModel.find({ _id: { $in: ids } }).lean() : [];
        return Object.fromEntries(rows.map((c) => [String(c._id), c.name]));
      },
    },
    {
      name: "buildReport",
      run: async (ctx) => {
        const days = Number(process.env.ATTENTION_DAYS ?? 7);
        const flagged = ctx.outputs.findAttention as { orderNumber: string; customerId: string; totalAmount: number }[];
        const names = ctx.outputs.lookupCustomers as Record<string, string>;
        const lines = flagged.map((o) => `${o.orderNumber} (${names[o.customerId] ?? "unknown customer"}): ${o.totalAmount}`);
        return {
          generatedAt: new Date().toISOString(),
          count: flagged.length,
          text: `Orders pending for ${days}+ days: ${flagged.length}.` + (lines.length ? "\n" + lines.join("\n") : ""),
        };
      },
    },
  ],
};