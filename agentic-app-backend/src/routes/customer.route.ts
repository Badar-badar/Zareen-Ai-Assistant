import express from "express";
import { customerController } from "../controllers/customers.controller.js";
import { validate } from "../middleware/validate.js";
import { LimitQuery, IdParam } from "../validation/schemas.js";

const router = express.Router();

router.get("/", validate(LimitQuery, "query"), customerController.getAllCustomers);
router.get("/:id", validate(IdParam, "params"), customerController.getCustomerById);

export default router;