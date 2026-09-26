import express from "express";
import { orderController } from "../controllers/orders.controller";

const router = express.Router();

router.get("/", orderController.getAllOrders);
router.get("/:id", orderController.getOrderById);

export default router;