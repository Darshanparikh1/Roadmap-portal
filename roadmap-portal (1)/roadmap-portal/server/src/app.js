import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env, isTest } from "./config/env.js";
import { router } from "./routes/index.js";
import { errorHandler, notFound } from "./middleware/error.js";

export function createApp() {
  const app = express();

  // Behind a proxy (Render, Railway, nginx) this makes req.ip and rate limiting correct.
  app.set("trust proxy", 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true, // required for cookie auth
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    }),
  );
  app.use(express.json({ limit: "200kb" }));
  app.use(cookieParser());
  if (!isTest) app.use(morgan("dev"));

  // Canonical mount point.
  app.use("/api/v1", router);
  // Compatibility alias: some proxies and gateways strip the "/api" prefix before forwarding.
  // Without this, those setups get a 404 on every call with no obvious cause.
  app.use("/v1", router);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
