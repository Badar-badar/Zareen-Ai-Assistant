import express from "express";
import { weatherController } from "../controllers/weather.controller.js";
const router = express.Router();

router.get("/:city", weatherController.getWeather);

export default router;