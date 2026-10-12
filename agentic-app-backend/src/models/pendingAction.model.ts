import mongoose from "mongoose";

const PendingActionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    type: { type: String, enum: ["createOrder", "createCustomer"], required: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true }, // the exact data that will be written
    summary: { type: String, required: true },                      // card text, built by the server
    fingerprint: { type: String, required: true },                  // detects identical duplicate proposals
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled", "failed"],
      default: "pending",
    },
    resultId: { type: String },
    resultLabel: { type: String },
    error: { type: String },
    expiresAt: { type: Date, required: true }, // after this, it can no longer be confirmed
    purgeAt: { type: Date, required: true },   // after this, MongoDB deletes the record
  },
  { timestamps: true }
);

PendingActionSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("PendingAction", PendingActionSchema);