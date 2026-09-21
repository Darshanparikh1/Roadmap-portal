import { ApiError, asyncHandler } from "../utils/api-error.js";
import { ACCESS_COOKIE, verifyToken } from "../utils/tokens.js";
import { User } from "../models/user.model.js";

function extractToken(req) {
  if (req.cookies?.[ACCESS_COOKIE]) return req.cookies[ACCESS_COOKIE];
  const header = req.get("authorization") ?? "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
}

async function resolveUser(token) {
  const claims = verifyToken(token, "access");
  const user = await User.findById(claims.sub);
  if (!user) throw ApiError.unauthorized("Account no longer exists", "invalid_token");
  // A password reset invalidates every access token issued before it.
  if (user.passwordChangedAt && claims.iat * 1000 < Math.floor(user.passwordChangedAt.getTime() / 1000) * 1000) {
    throw ApiError.unauthorized("Session ended after a password change", "token_revoked");
  }
  return user;
}

/** Anonymous is fine, but a present-and-expired token still 401s so the client knows to refresh. */
export const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (token) req.user = await resolveUser(token);
  next();
});

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized();
  req.user = await resolveUser(token);
  next();
});

export const requireVerified = asyncHandler(async (req, _res, next) => {
  if (!req.user?.isVerified) throw ApiError.forbidden("Verify your email address first", "email_not_verified");
  next();
});

/** Role-based access control for the admin panel. */
export const requireAdmin = asyncHandler(async (req, _res, next) => {
  if (req.user?.role !== "admin") throw ApiError.forbidden("Admin access required");
  next();
});
