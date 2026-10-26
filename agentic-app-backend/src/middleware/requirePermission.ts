import type { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";
import UserModel from "../models/user.model.js";
import { can, toRole, type Permission } from "../mcp/permissions.js";

// Reads the role from the database (not the token), so a demoted user is refused straight away.
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
