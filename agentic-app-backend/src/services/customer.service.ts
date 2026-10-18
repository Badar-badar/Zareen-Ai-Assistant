
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
       const parsedLimit = Math.min(Math.max(isNaN(limitNum) ? 4 : limitNum, 1), 100);
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
