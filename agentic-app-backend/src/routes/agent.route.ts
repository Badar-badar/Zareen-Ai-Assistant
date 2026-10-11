import express from "express";
import { agentController } from "../controllers/agent.controller.js";
import { userLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { ChatBody, SessionIdParam } from "../validation/schemas.js";

const router = express.Router();

router.post("/", userLimiter, validate(ChatBody), agentController.chat);
router.delete("/:sessionId", validate(SessionIdParam, "params"), agentController.deleteSession);

export default router;