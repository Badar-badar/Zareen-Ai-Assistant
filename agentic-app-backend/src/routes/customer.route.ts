import express from "express";
import { customerController } from "../controllers/customers.controller.js";

const router = express.Router();

router.get("/", customerController.getAllCustomers);
router.get("/:id", customerController.getCustomerById);

export default router;  