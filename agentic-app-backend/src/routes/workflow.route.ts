import express from "express";
import { workflowController } from "../controllers/workflow.controller.js";
import { userLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { ObjectIdParam, StartWorkflowBody } from "../validation/schemas.js";

const router = express.Router();

router.post("/", userLimiter, validate(StartWorkflowBody), requirePermission("orders:propose"), workflowController.start);
router.get("/:id", validate(ObjectIdParam, "params"), workflowController.get);

export default router;