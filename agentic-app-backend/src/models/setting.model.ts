import mongoose from "mongoose";

const SettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: mongoose.Schema.Types.Mixed,
    updatedBy: String,
  },
  { timestamps: true }
);

export default mongoose.model("Setting", SettingSchema);