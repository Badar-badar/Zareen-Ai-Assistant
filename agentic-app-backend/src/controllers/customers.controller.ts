import { Request, Response } from "express";
import { getAllCustomers, getCustomerById, createCustomer } from "../services/customer.service.js";

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
     },
     async createCustomer(req: Request, res: Response) {
          try {
                const { name, email, phone, address, city, state, zip, zipCode, country, status } = req.body;
                if (!name || !email) {
                     return res.status(400).json({ message: "Name and email are required" });
                }

                const formattedAddress =
                     typeof address === "object" && address !== null
                          ? address
                          : (address || city || state || zip || zipCode || country)
                          ? {
                                 street: typeof address === "string" ? address : undefined,
                                 city,
                                 state,
                                 zipCode: zipCode || zip,
                                 country,
                            }
                          : undefined;

                const customer = await createCustomer({
                     name,
                     email,
                     phone,
                     address: formattedAddress,
                     status,
                });
               return res.status(201).json({ customer });
          } catch (error) {
               console.log(error);
               return res.status(500).json({ message: "Internal server error" });
          }
     }
}

