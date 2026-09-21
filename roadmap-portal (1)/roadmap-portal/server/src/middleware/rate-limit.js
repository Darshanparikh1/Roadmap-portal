import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";

const build = (max, windowMinutes) =>
  rateLimit({
    windowMs: windowMinutes * 60_000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !env.RATE_LIMIT_ENABLED,
    handler: (_req, _res, next) => next(ApiError.tooMany()),
  });

/** Brute-force protection on credentials and one-time links. */
export const authLimiter = build(env.AUTH_RATE_LIMIT_MAX, env.AUTH_RATE_LIMIT_WINDOW_MINUTES);
/** Keeps a script from flooding the feed with posts or comments. */
export const writeLimiter = build(60, 10);
