import { Request, Response } from "express";
import mongoose from "mongoose";
import WorkflowModel from "../models/workflow.model.js";
import { createWorkflow, runWorkflow } from "../services/workflow.service.js";
import "../workflows/auditOrders.js"; // registers the workflow types

export const workflowController = {
  async start(req: Request, res: Response) {
    const userId = req.user!.id;
    const active = await WorkflowModel.countDocuments({ userId, status: { $in: ["pending", "running"] } });
    if (active >= 2) return res.status(429).json({ error: "You already have workflows running." });

    const id = await createWorkflow(userId, req.body.type, req.body.params ?? {});
    void runWorkflow(id).catch((e) => console.error("workflow failed to start", e?.message));
    return res.status(202).json({ id });
  },

  async get(req: Request, res: Response) {
    const id = req.params.id as string;
    if (!mongoose.isValidObjectId(id)) return res.status(404).json({ error: "Workflow not found" });
    const wf: any = await WorkflowModel.findOne({ _id: id, userId: req.user!.id }).lean(); // someone else's = 404
    if (!wf) return res.status(404).json({ error: "Workflow not found" });
    return res.json({
      id,
      type: wf.type,
      status: wf.status,
      error: wf.error ?? null,
      steps: wf.steps.map((s: any) => ({ name: s.name, status: s.status, attempts: s.attempts, error: s.error ?? null })),
      result: wf.status === "done" ? wf.result : null,
    });
  },
};