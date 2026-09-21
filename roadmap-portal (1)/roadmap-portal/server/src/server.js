import { createApp } from "./app.js";
import { connectDb } from "./db/connect.js";
import { env } from "./config/env.js";
import { ensureAdmin } from "./seed.js";

const app = createApp();

try {
  await connectDb();
  console.log(`MongoDB connected → ${env.MONGODB_URI.replace(/\/\/[^@]*@/, "//***@")}`);
  await ensureAdmin();
  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}/api/v1  (${env.NODE_ENV})`);
  });
} catch (err) {
  console.error("Failed to start:", err.message);
  process.exit(1);
}
