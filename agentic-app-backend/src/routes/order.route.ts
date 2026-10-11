import express from "express";
import { orderController } from "../controllers/orders.controller.js";
import { validate } from "../middleware/validate.js";
import { LimitQuery, IdParam, CreateOrderBody } from "../validation/schemas.js";

const router = express.Router();

router.get("/", validate(LimitQuery, "query"), orderController.getAllOrders);
router.get("/:id", validate(IdParam, "params"), orderController.getOrderById);
router.post("/", validate(CreateOrderBody), orderController.createOrder);

export default router;