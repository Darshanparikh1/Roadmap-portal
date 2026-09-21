import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ApiError } from "./api-error.js";

export const ACCESS_COOKIE = "access_token";
export const REFRESH_COOKIE = "refresh_token";
/** Readable by the SPA, carries no secret: it only says "a session probably exists". */
export const SESSION_HINT_COOKIE = "session_hint";
/** The refresh cookie is only ever sent to the auth routes, never to the content API. */
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

export const accessTtlMs = () => env.ACCESS_TOKEN_TTL_MINUTES * 60_000;
export const refreshTtlMs = () => env.REFRESH_TOKEN_TTL_DAYS * 86_400_000;

export function signAccessToken(user) {
  const expiresAt = new Date(Date.now() + accessTtlMs());
  const token = jwt.sign({ sub: String(user._id), role: user.role, type: "access" }, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`,
    jwtid: crypto.randomUUID(),
  });
  return { token, expiresAt };
}

export function signRefreshToken({ userId, familyId, jti }) {
  const expiresAt = new Date(Date.now() + refreshTtlMs());
  const token = jwt.sign({ sub: String(userId), fam: familyId, type: "refresh" }, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`,
    jwtid: jti,
  });
  return { token, expiresAt };
}

export function verifyToken(token, kind) {
  const secret = kind === "access" ? env.JWT_ACCESS_SECRET : env.JWT_REFRESH_SECRET;
  try {
    const claims = jwt.verify(token, secret);
    if (claims.type !== kind) throw new Error("wrong type");
    return claims;
  } catch (err) {
    if (err.name === "TokenExpiredError") throw ApiError.unauthorized("Session expired", "token_expired");
    throw ApiError.unauthorized("Invalid token", "invalid_token");
  }
}

export const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");

/** Returns [rawTokenForTheEmail, hashForTheDatabase]. Only the hash is ever stored. */
export function createOneTimeToken() {
  const raw = crypto.randomBytes(32).toString("base64url");
  return [raw, sha256(raw)];
}

const baseCookie = () => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE,
  sameSite: env.COOKIE_SAMESITE,
  domain: env.COOKIE_DOMAIN || undefined,
});

export function setAuthCookies(res, { accessToken, refreshToken }) {
  res.cookie(ACCESS_COOKIE, accessToken, { ...baseCookie(), path: "/", maxAge: accessTtlMs() });
  res.cookie(REFRESH_COOKIE, refreshToken, { ...baseCookie(), path: REFRESH_COOKIE_PATH, maxAge: refreshTtlMs() });
  res.cookie(SESSION_HINT_COOKIE, "1", { ...baseCookie(), httpOnly: false, path: "/", maxAge: refreshTtlMs() });
}

export function clearAuthCookies(res) {
  res.clearCookie(ACCESS_COOKIE, { ...baseCookie(), path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...baseCookie(), path: REFRESH_COOKIE_PATH });
  res.clearCookie(SESSION_HINT_COOKIE, { ...baseCookie(), httpOnly: false, path: "/" });
}
