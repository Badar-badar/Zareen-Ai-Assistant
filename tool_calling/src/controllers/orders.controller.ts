import { Request, Response } from "express";
import { getOrdersWithCustomerDetails, getLatestOrders, getOrderById } from "../services/order.service";

export const orderController = {
     async getOrderById(req: Request, res: Response) {
          try {
               const orderId = req.params.id as string;
               const order = await getOrderById(orderId);
               if (!order) {
                    return res.status(404).json({ message: "Order not found" });
               }
               return res.status(200).json({ order });
          } catch (error) {
               console.log(error);
               return res.status(500).json({ message: "Internal server error" });
          }
     },

     async getAllOrders(req: Request, res: Response) {
          try {
               const limit = req.query.limit as string;
               const orders = await getLatestOrders(limit);
               return res.status(200).json({ orders });
          } catch (error) {
               console.log(error);
               return res.status(500).json({ message: "Internal server error" });
          }
     },

     async getOrdersWithCustomerDetails(req: Request, res: Response) {
          try {
               const limit = req.query.limit as string;
               const orders = await getOrdersWithCustomerDetails(limit);
               return res.status(200).json({ orders });
          } catch (error) {
               console.log(error);
               return res.status(500).json({ message: "Internal server error" });
          }
     }
}