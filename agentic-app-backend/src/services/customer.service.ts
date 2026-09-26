// ==========================================
// 1. In-Memory (Mock Data) Implementation
// ==========================================
// import { Customer, customers } from "../data/customer.data.js";
//
// export async function getAllCustomers(limit: number | string = 4): Promise<Customer[]> {
//     try {
//         const limitNum = typeof limit === "number" ? limit : parseInt(limit as any, 10);
//         const sorted = [...customers].sort(
//             (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
//         );
//         return sorted.slice(0, isNaN(limitNum) ? 4 : limitNum);
//     } catch (error) {
//         console.log(error);
//         throw error;
//     }
// }
//
// export async function getCustomerById(id: string): Promise<Customer | undefined> {
//     try {
//         const customer = customers.find((c) => c.id === id);
//         return customer;
//     } catch (error) {
//         throw error;
//     }
// }

// ==========================================
// 2. MongoDB Model Implementation
// ==========================================
import mongoose from "mongoose";
import CustomerModel, { ICustomer } from "../models/customer.model.js";

function formatCustomer(doc: any) {
    return {
        id: doc._id ? doc._id.toString() : doc.id,
        name: doc.name,
        email: doc.email,
        phone: doc.phone || "",
        address: {
            street: doc.address?.street || "",
            city: doc.address?.city || "",
            state: doc.address?.state || "",
            zipCode: doc.address?.zipCode || "",
            country: doc.address?.country || ""
        },
        createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date().toISOString(),
        status: (doc.status as "active" | "inactive") || "active"
    };
}

export type FormattedCustomer = ReturnType<typeof formatCustomer>;

export async function getAllCustomers(limit: number | string = 4) {
    try {
        const limitNum = typeof limit === "number" ? limit : parseInt(limit as any, 10);
        const parsedLimit = isNaN(limitNum) ? 4 : limitNum;
        const docs = await CustomerModel.find()
            .sort({ createdAt: -1 })
            .limit(parsedLimit);
        return docs.map(formatCustomer);
    } catch (error) {
        console.log("Error in getAllCustomers:", error);
        throw error;
    }
}

export async function getCustomerById(id: string) {
    try {
        const isObjectId = mongoose.isValidObjectId(id);
        const doc = await CustomerModel.findOne(
            isObjectId ? { _id: id } : { email: id }
        );
        if (!doc) return undefined;
        return formatCustomer(doc);
    } catch (error) {
        console.log("Error in getCustomerById:", error);
        throw error;
    }
}

export async function createCustomer(data: {
    name: string;
    email: string;
    phone?: string;
    address?: ICustomer["address"];
    status?: "active" | "inactive";
}) {
    try {
        const doc = await CustomerModel.create(data);
        return formatCustomer(doc);
    } catch (error) {
        console.log("Error in createCustomer:", error);
        throw error;
    }
}
