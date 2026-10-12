import express from "express";
import { actionController } from "../controllers/action.controller.js";
import { actionLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { ObjectIdParam } from "../validation/schemas.js";

const router = express.Router();

router.post("/:id/confirm", actionLimiter, validate(ObjectIdParam, "params"), actionController.confirm);
router.post("/:id/cancel", actionLimiter, validate(ObjectIdParam, "params"), actionController.cancel);

export default router;