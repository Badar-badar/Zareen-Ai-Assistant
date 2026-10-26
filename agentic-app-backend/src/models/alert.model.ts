import mongoose from "mongoose";

const AlertSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // the same problem alerts only once
  kind: { type: String, required: true },
  job: String,
  message: String,
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});
AlertSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("Alert", AlertSchema);