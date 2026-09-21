import mongoose from "mongoose";

/**
 * One row per issued refresh token (id === the JWT's jti). Tokens from the same login share a
 * familyId, so a leaked-and-replayed token can take its whole family down with it.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    jti: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedBy: { type: String, default: null },
    userAgent: { type: String },
  },
  { timestamps: true },
);
// Mongo clears expired rows on its own.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const oneTimeTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    purpose: { type: String, enum: ["verify_email", "reset_password"], required: true },
    tokenHash: { type: String, required: true, unique: true, index: true }, // never the raw token
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
oneTimeTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86_400 });

const outboxEmailSchema = new mongoose.Schema(
  {
    to: { type: String, required: true, index: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },
    actionUrl: { type: String },
  },
  { timestamps: true },
);

export const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
export const OneTimeToken = mongoose.model("OneTimeToken", oneTimeTokenSchema);
export const OutboxEmail = mongoose.model("OutboxEmail", outboxEmailSchema);
