import mongoose from "mongoose";
import { env } from "../config/env.js";

mongoose.set("strictQuery", true);
// Lean documents by default would hide Mongoose helpers; instead keep virtuals in JSON output.
mongoose.set("toJSON", { virtuals: true });

export async function connectDb(uri = env.MONGODB_URI) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    autoIndex: env.NODE_ENV !== "production", // build indexes in dev/test; use a migration in prod
  });
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
