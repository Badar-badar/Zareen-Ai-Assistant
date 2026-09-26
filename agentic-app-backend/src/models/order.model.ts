import mongoose, { Document } from "mongoose";

export interface IOrder extends Document {
    customerId: string;
    orderNumber: string;
    orderDate: Date;
    totalAmount: number;
    status: "pending" | "completed" | "cancelled";
    createdAt?: Date;
    updatedAt?: Date;
}

const OrderSchema = new mongoose.Schema<IOrder>(
    {
        customerId: { type: String, required: true },
        orderNumber: { type: String, required: true },
        orderDate: { type: Date, default: Date.now },
        totalAmount: { type: Number, required: true },
        status: { type: String, enum: ["pending", "completed", "cancelled"], default: "pending" },
    }, { timestamps: true });

const Order = mongoose.model<IOrder>("Order", OrderSchema);

export default Order;