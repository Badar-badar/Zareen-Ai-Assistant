import { Request, Response } from "express";
import { setPaused, status } from "../services/scheduler.service.js";

export const schedulerController = {
  async status(_req: Request, res: Response) {
    return res.json(await status());
  },
  async pause(req: Request, res: Response) {
    await setPaused(true, req.user!.id);
    return res.json({ paused: true });
  },
  async resume(req: Request, res: Response) {
    await setPaused(false, req.user!.id);
    return res.json({ paused: false });
  },
};