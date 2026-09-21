/**
 * Every failure the API returns on purpose is an ApiError, so the error handler can
 * emit one consistent shape: { error: { code, message, details? } }.
 */
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details) {
    return new ApiError(400, "bad_request", message, details);
  }
  static unauthorized(message = "Sign in to continue", code = "not_authenticated") {
    return new ApiError(401, code, message);
  }
  static forbidden(message = "You don't have access to this", code = "forbidden") {
    return new ApiError(403, code, message);
  }
  static notFound(message = "Not found") {
    return new ApiError(404, "not_found", message);
  }
  static conflict(message, code = "conflict") {
    return new ApiError(409, code, message);
  }
  static tooMany(message = "Too many attempts. Try again later") {
    return new ApiError(429, "rate_limited", message);
  }
}

/** Wraps async route handlers so rejected promises reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
