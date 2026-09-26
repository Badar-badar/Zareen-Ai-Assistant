import express from "express";
import {agentController} from "../controllers/agent.controller.js";

const router = express.Router();

router.post("/", agentController.chat);

export default router;