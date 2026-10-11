import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "model"], required: true },
    text: { type: String, required: true },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const ChatSessionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    messages: { type: [MessageSchema], default: [] },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// MongoDB deletes the document once expiresAt has passed (it checks about once a minute)
ChatSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("ChatSession", ChatSessionSchema);