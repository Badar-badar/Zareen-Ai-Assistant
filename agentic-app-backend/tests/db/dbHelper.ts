import mongoose from "mongoose";
import { beforeAll, afterAll, beforeEach } from "vitest";
import ChatSession from "../../src/models/chatSession.model.js";
import PendingAction from "../../src/models/pendingAction.model.js";
import CustomerModel from "../../src/models/customer.model.js";
import OrderModel from "../../src/models/order.model.js";
import UserModel from "../../src/models/user.model.js";
// Database tests run only when MONGODB_TEST_URI is set (CI sets it).
export const TEST_URI = process.env.MONGODB_TEST_URI;
export const hasDb = Boolean(TEST_URI);

export function useTestDb() {
  beforeAll(async () => {
    await mongoose.connect(TEST_URI!, { serverSelectionTimeoutMS: 8_000 });
    // SAFETY: these tests delete everything in these collections, so refuse to touch a database that isn't clearly a test one
    if (!/test/i.test(mongoose.connection.name)) {
      await mongoose.disconnect();
      throw new Error(`Refusing to run: database "${mongoose.connection.name}" does not contain "test" in its name`);
    }
    await Promise.all([ChatSession.init(), PendingAction.init()]);
  });

  beforeEach(async () => {
      await Promise.all([
      ChatSession.deleteMany({}), PendingAction.deleteMany({}), CustomerModel.deleteMany({}),
      OrderModel.deleteMany({}), UserModel.deleteMany({}),
    ]);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });
}

export async function makeCustomer(name = "Bilal Khan", email = "bilal@example.com") {
  const c = await CustomerModel.create({ name, email });
  return c._id.toString();
}

export async function makeUser(role: "viewer" | "staff" | "admin", email = `${role}-${Math.random().toString(36).slice(2)}@example.com`) {
  const u = await UserModel.create({ email, passwordHash: "x", role });
  return u._id.toString();
}