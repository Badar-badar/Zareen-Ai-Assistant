import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
       role: { type: String, enum: ["viewer", "staff", "admin"], default: "viewer" },
  },
  { timestamps: true }
);

export default mongoose.model("User", UserSchema);