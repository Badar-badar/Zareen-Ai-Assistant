import express from "express";
import { schedulerController } from "../controllers/scheduler.controller.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = express.Router();

// Admin only. The role is read from the database on every call.
router.get("/", requirePermission("admin:manage"), schedulerController.status);
router.post("/pause", requirePermission("admin:manage"), schedulerController.pause);
router.post("/resume", requirePermission("admin:manage"), schedulerController.resume);

export default router;