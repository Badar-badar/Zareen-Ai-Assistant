import mongoose, { Document } from "mongoose";

export interface ICustomer extends Document {
    name: string;
    email: string;
    phone?: string;
    address?: {
        street?: string;
        city?: string;
        state?: string;
        zipCode?: string;
        country?: string;
    };
    status?: "active" | "inactive";
    createdAt?: Date;
    updatedAt?: Date;
}

const CustomerSchema = new mongoose.Schema<ICustomer>({
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, default: "" },
    address: {
        street: { type: String, default: "" },
        city: { type: String, default: "" },
        state: { type: String, default: "" },
        zipCode: { type: String, default: "" },
        country: { type: String, default: "" }
    },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
}, { timestamps: true });

const Customer = mongoose.model<ICustomer>("Customer", CustomerSchema);

export default Customer;