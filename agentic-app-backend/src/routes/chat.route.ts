import express from "express";
import { chatController } from "../controllers/chat.controller.js";
import { userLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";
import { ChatBody } from "../validation/schemas.js";

const router = express.Router();

router.post("/", userLimiter, validate(ChatBody), chatController.getChatResponse);

export default router;