import { Request, Response } from "express";
import { getAllCustomers, getCustomerById } from "../services/customer.service";

export const customerController = {
     async getAllCustomers(req: Request, res: Response) {
          try {
               const limit = req.query.limit as string;
               const customers = await getAllCustomers(limit ? parseInt(limit, 10) : undefined);
               return res.status(200).json({ customers });
          } catch (error) {
               console.log(error);
               return res.status(500).json({ message: "Internal server error" });
          }
     },

     async getCustomerById(req: Request, res: Response) {
          try {
               const customerId = req.params.id as string;
               const customer = await getCustomerById(customerId);
               if (!customer) {
                    return res.status(404).json({ message: "Customer not found" });
               }
               return res.status(200).json({ customer });
          } catch (error) {
               console.log(error);
               return res.status(500).json({ message: "Internal server error" });
          }
     }
}

