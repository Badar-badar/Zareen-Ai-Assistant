// ==========================================
// 1. In-Memory (Mock Data) Implementation
// ==========================================
// import { Order, orders } from "../data/order.data.js";
// import { customers } from "../data/customer.data.js";
//
// export async function getLatestOrders(limit: number | string = 4): Promise<Order[]> {
//     try {
//         const limitNum = typeof limit === "number" ? limit : parseInt(limit as any, 10);
//         const sorted = [...orders].sort(
//             (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
//         );
//         return sorted.slice(0, isNaN(limitNum) ? 4 : limitNum);
//     } catch (error) {
//         console.log(error);
//         throw error;
//     }
// }
//
// export async function getOrdersWithCustomerDetails(limit: number | string = 4) {
//     try {
//         const latestOrders = await getLatestOrders(limit);
//         return latestOrders.map((order) => {
//             const customer = customers.find((c) => c.id === order.customerId);
//             return {
//                 ...order,
//                 customer: customer
//                     ? { name: customer.name, email: customer.email, phone: customer.phone }
//                     : null
//             };
//         });
//     } catch (error) {
//         console.log(error);
//         throw error;
//     }
// }
//
// export async function getOrderById(id: string): Promise<Order | undefined> {
//     try {
//         const order = orders.find((o) => o.id === id);
//         return order;
//     } catch (error) {
//         console.log(error);
//         throw error;
//     }
// }

// ==========================================
// 2. MongoDB Model Implementation
// ==========================================
import mongoose from "mongoose";
import OrderModel from "../models/order.model.js";
import CustomerModel from "../models/customer.model.js";

function formatOrder(doc: any) {
    return {
        id: doc._id.toString(),
        customerId: doc.customerId,
        orderNumber: doc.orderNumber,
        orderDate: doc.orderDate ? new Date(doc.orderDate).toISOString() : new Date().toISOString(),
        totalAmount: doc.totalAmount,
        status: doc.status,
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString()
    };
}

export async function getLatestOrders(limit: number | string = 4) {
    try {
        const limitNum = typeof limit === "number" ? limit : parseInt(limit as any, 10);
        const parsedLimit = isNaN(limitNum) ? 4 : limitNum;
        const docs = await OrderModel.find()
            .sort({ createdAt: -1 })
            .limit(parsedLimit);
        return docs.map(formatOrder);
    } catch (error) {
        console.log("Error in getLatestOrders:", error);
        throw error;
    }
}

export async function getOrdersWithCustomerDetails(limit: number | string = 4) {
    try {
        const latestOrders = await getLatestOrders(limit);

        const ordersWithCustomer = await Promise.all(
            latestOrders.map(async (order) => {
                let customer = null;
                if (mongoose.isValidObjectId(order.customerId)) {
                    const customerDoc = await CustomerModel.findById(order.customerId);
                    if (customerDoc) {
                        customer = {
                            id: customerDoc._id.toString(),
                            name: customerDoc.name,
                            email: customerDoc.email,
                            phone: customerDoc.phone
                        };
                    }
                }
                return {
                    ...order,
                    customer
                };
            })
        );

        return ordersWithCustomer;
    } catch (error) {
        console.log("Error in getOrdersWithCustomerDetails:", error);
        throw error;
    }
}

export async function getOrderById(id: string) {
    try {
        const isObjectId = mongoose.isValidObjectId(id);
        const doc = await OrderModel.findOne(
            isObjectId ? { $or: [{ _id: id }, { orderNumber: id }] } : { orderNumber: id }
        );
        if (!doc) return undefined;
        return formatOrder(doc);
    } catch (error) {
        console.log("Error in getOrderById:", error);
        throw error;
    }
}

export async function createOrder(data: {
    customerId: string;
    orderNumber?: string;
    orderDate?: Date | string;
    totalAmount: number;
    status?: "pending" | "completed" | "cancelled";
}) {
    try {
        const doc = await OrderModel.create({
            customerId: data.customerId,
            orderNumber: data.orderNumber || `ORD-${Date.now()}`,
            orderDate: data.orderDate ? new Date(data.orderDate) : new Date(),
            totalAmount: data.totalAmount,
            status: data.status || "pending"
        });

        return formatOrder(doc);
    } catch (error) {
        console.log("Error in createOrder:", error);
        throw error;
    }
}
