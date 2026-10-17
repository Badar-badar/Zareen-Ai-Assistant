import type { Request, Response, NextFunction } from "express";
import UserModel from "../models/user.model.js";
import { can, toRole, type Permission } from "../mcp/permissions.js";
import mongoose from "mongoose";
export const requirePermission = (p: Permission) => async (req: Request, res: Response, next: NextFunction) => {
  try {
        if (!mongoose.isValidObjectId(req.user!.id)) {
      return res.status(403).json({ error: "You don't have permission to do this." });
    }
    const user = await UserModel.findById(req.user!.id).select("role").lean<{ role?: string }>();
    if (!user || !can(toRole(user.role), p)) {
      return res.status(403).json({ error: "You don't have permission to do this." });
    }
    next();
  } catch (err) {
    next(err);
  }
};