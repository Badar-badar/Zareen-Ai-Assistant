import express from "express";
import { weatherController } from "../controllers/weather.controller.js";
import { validate } from "../middleware/validate.js";
import { CityParam } from "../validation/schemas.js";

const router = express.Router();

router.get("/:city", validate(CityParam, "params"), weatherController.getWeather);

export default router;