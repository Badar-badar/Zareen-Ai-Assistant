import express from "express";
import { orderController } from "../controllers/orders.controller.js";

const router = express.Router();

router.get("/", orderController.getAllOrders);
router.get("/:id", orderController.getOrderById);
router.post("/", orderController.createOrder);

export default router;