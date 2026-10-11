import mongoose from "mongoose";
import UserModel from "../models/user.model.js";
import { hashPassword } from "../utils/password.js";

const [email, password] = process.argv.slice(2);
if (!email || !password || password.length < 12) {
  console.error("usage: npm run create-user -- <email> <password, 12+ chars>");
  process.exit(1);
}
await mongoose.connect(process.env.MONGODB_URI!);
await UserModel.create({ email: email.toLowerCase(), passwordHash: await hashPassword(password), role: "user" });
console.log("created", email);
await mongoose.disconnect();