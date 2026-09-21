import mongoose from "mongoose";
import { ApiError } from "../utils/api-error.js";
import { isProd } from "../config/env.js";

export function notFound(req, _res, next) {
  // Name the path and the mount point: a wrong proxy prefix is the usual cause, and a bare
  // "Route not found" sends people hunting through their own code first.
  next(
    ApiError.notFound(
      `No route for ${req.method} ${req.originalUrl}. The API is mounted at /api/v1 — try /api/v1${req.path}`,
    ),
  );
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
export function errorHandler(err, _req, res, _next) {
  let error = err;

  if (err instanceof mongoose.Error.CastError) {
    error = ApiError.badRequest("Malformed id");
  } else if (err instanceof mongoose.Error.ValidationError) {
    error = new ApiError(422, "validation_error", Object.values(err.errors)[0]?.message ?? "Invalid data");
  } else if (err?.code === 11000) {
    error = ApiError.conflict("That value is already taken", "duplicate_key");
  } else if (!(err instanceof ApiError)) {
    error = new ApiError(500, "server_error", "Something went wrong on the server");
  }

  if (error.status >= 500) console.error(err);

  res.status(error.status).json({
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
      ...(isProd || error.status < 500 ? {} : { stack: err.stack }),
    },
  });
}
