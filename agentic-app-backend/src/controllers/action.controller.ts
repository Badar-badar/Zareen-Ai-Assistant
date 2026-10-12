import { Request, Response } from "express";
import { confirmAction, cancelAction } from "../services/pendingAction.service.js";

// Only a logged-in person's HTTP request reaches these. The model has no tool that calls them.
export const actionController = {
  async confirm(req: Request, res: Response) {
    const out = await confirmAction(req.user!.id, req.params.id as string);
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    return res.json({ id: out.id, status: out.status, resultId: out.resultId, label: out.label });
  },

  async cancel(req: Request, res: Response) {
    const out = await cancelAction(req.user!.id, req.params.id as string);
    if (!out.ok) return res.status(out.status).json({ error: out.error });
    return res.json({ id: out.id, status: out.status });
  },
};