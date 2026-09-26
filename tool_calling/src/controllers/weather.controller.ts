import { weatherService } from "../services/weather.service.js";
import { Request, Response } from "express";
export const weatherController = {
    async getWeather(req: Request, res: Response) {
        try {
            const rawCity = req.params.city || req.query.city;
            if (!rawCity || typeof rawCity !== "string") {
                return res.status(400).json({ message: "City parameter is required and must be a string" });
            }
            const data = await weatherService.fetchWeather(rawCity);
            return res.json(data);
        } catch (error) {
            console.log(error);
            return res.status(500).json({ message: "Internal server error" });
        }
    }
};