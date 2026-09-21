import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { ApiError, asyncHandler } from "../utils/api-error.js";
import { User } from "../models/user.model.js";
import { OneTimeToken, RefreshToken } from "../models/token.model.js";
import { sendPasswordResetEmail, sendVerificationEmail } from "../services/email.service.js";
import {
  REFRESH_COOKIE,
  clearAuthCookies,
  createOneTimeToken,
  setAuthCookies,
  sha256,
  signAccessToken,
  signRefreshToken,
  verifyToken,
} from "../utils/tokens.js";

/** A real hash, so login takes the same time whether or not the email exists. */
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString("hex"), 10);

async function issueOneTimeToken(user, purpose, ttlMs) {
  // Only the newest link of each kind stays valid.
  await OneTimeToken.updateMany({ user: user._id, purpose, usedAt: null }, { usedAt: new Date() });
  const [raw, tokenHash] = createOneTimeToken();
  await OneTimeToken.create({ user: user._id, purpose, tokenHash, expiresAt: new Date(Date.now() + ttlMs) });
  return raw;
}

async function consumeOneTimeToken(raw, purpose) {
  const token = await OneTimeToken.findOne({ tokenHash: sha256(raw), purpose });
  if (!token || token.usedAt) throw ApiError.badRequest("This link is invalid or has already been used");
  if (token.expiresAt < new Date()) throw ApiError.badRequest("This link has expired. Request a new one");
  token.usedAt = new Date();
  await token.save();
  const user = await User.findById(token.user);
  if (!user) throw ApiError.badRequest("This link is invalid");
  return user;
}

async function startSession(res, req, user, familyId = crypto.randomUUID()) {
  const jti = crypto.randomUUID();
  const { token: accessToken, expiresAt } = signAccessToken(user);
  const { token: refreshToken, expiresAt: refreshExpiresAt } = signRefreshToken({ userId: user._id, familyId, jti });
  await RefreshToken.create({
    jti,
    user: user._id,
    familyId,
    expiresAt: refreshExpiresAt,
    userAgent: (req.get("user-agent") ?? "").slice(0, 255),
  });
  setAuthCookies(res, { accessToken, refreshToken });
  return { jti, body: { user: user.toPublicJSON(), accessTokenExpiresAt: expiresAt } };
}

const revokeFamily = (familyId) =>
  RefreshToken.updateMany({ familyId, revokedAt: null }, { revokedAt: new Date() });

export const signup = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  if (await User.exists({ email })) throw ApiError.conflict("An account with this email already exists", "email_taken");

  const user = new User({ name, email });
  await user.setPassword(password);
  await user.save();

  const raw = await issueOneTimeToken(user, "verify_email", env.EMAIL_VERIFICATION_TTL_HOURS * 3_600_000);
  await sendVerificationEmail({ to: user.email, name: user.name, rawToken: raw });

  res.status(201).json({ message: "Account created. Check your inbox to verify your email." });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const user = await consumeOneTimeToken(req.body.token, "verify_email");
  user.isVerified = true;
  await user.save();
  res.json({ message: "Email verified. You can sign in now." });
});

export const resendVerification = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user && !user.isVerified) {
    const raw = await issueOneTimeToken(user, "verify_email", env.EMAIL_VERIFICATION_TTL_HOURS * 3_600_000);
    await sendVerificationEmail({ to: user.email, name: user.name, rawToken: raw });
  }
  // Same answer either way, so the endpoint can't be used to discover accounts.
  res.json({ message: "If that account needs verification, a new link is on its way." });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw ApiError.unauthorized("Email or password is incorrect", "invalid_credentials");
  if (!user.isVerified) throw ApiError.forbidden("Verify your email before signing in", "email_not_verified");

  const { body } = await startSession(res, req, user);
  res.json(body);
});

/**
 * Refresh-token rotation with reuse detection.
 * Every call revokes the token presented and issues a new pair in the same family. A token that
 * comes back after it was rotated has probably leaked, so the whole family is revoked.
 */
export const refresh = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (!raw) {
    clearAuthCookies(res);
    throw ApiError.unauthorized("No active session");
  }

  let claims;
  try {
    claims = verifyToken(raw, "refresh");
  } catch {
    clearAuthCookies(res);
    throw ApiError.unauthorized("Session expired. Sign in again", "token_expired");
  }

  const stored = await RefreshToken.findOne({ jti: claims.jti });
  if (!stored || String(stored.user) !== claims.sub) {
    clearAuthCookies(res);
    throw ApiError.unauthorized("Session not found. Sign in again", "invalid_token");
  }

  if (stored.revokedAt) {
    const withinGrace =
      stored.replacedBy && Date.now() - stored.revokedAt.getTime() <= env.REFRESH_REUSE_GRACE_SECONDS * 1000;
    const familyAlive = await RefreshToken.exists({ familyId: stored.familyId, revokedAt: null });
    if (withinGrace && familyAlive && stored.expiresAt > new Date()) {
      // Two tabs refreshed at once: a race, not a theft.
      const user = await User.findById(stored.user);
      const { body } = await startSession(res, req, user, stored.familyId);
      return res.json(body);
    }
    await revokeFamily(stored.familyId);
    clearAuthCookies(res);
    throw ApiError.unauthorized("Session was revoked for your security. Sign in again", "refresh_reuse_detected");
  }

  if (stored.expiresAt < new Date()) {
    clearAuthCookies(res);
    throw ApiError.unauthorized("Session expired. Sign in again", "token_expired");
  }

  const user = await User.findById(stored.user);
  if (!user) {
    clearAuthCookies(res);
    throw ApiError.unauthorized("Account no longer exists", "invalid_token");
  }

  const { jti, body } = await startSession(res, req, user, stored.familyId);
  stored.revokedAt = new Date();
  stored.replacedBy = jti;
  await stored.save();
  res.json(body);
});

export const logout = asyncHandler(async (req, res) => {
  const raw = req.cookies?.[REFRESH_COOKIE];
  if (raw) {
    try {
      const claims = verifyToken(raw, "refresh");
      const stored = await RefreshToken.findOne({ jti: claims.jti });
      if (stored) await revokeFamily(stored.familyId);
    } catch {
      // Logging out with a broken token is still a logout.
    }
  }
  clearAuthCookies(res);
  res.status(204).end();
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user) {
    const raw = await issueOneTimeToken(user, "reset_password", env.PASSWORD_RESET_TTL_MINUTES * 60_000);
    await sendPasswordResetEmail({ to: user.email, name: user.name, rawToken: raw });
  }
  res.json({ message: "If an account exists for that email, a reset link is on its way." });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const user = await consumeOneTimeToken(req.body.token, "reset_password");
  await user.setPassword(req.body.password);
  user.isVerified = true; // receiving the email proves they own the address
  await user.save();
  await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
  clearAuthCookies(res);
  res.json({ message: "Password updated. Sign in with your new password." });
});

export const me = asyncHandler(async (req, res) => {
  res.json(req.user.toPublicJSON());
});
