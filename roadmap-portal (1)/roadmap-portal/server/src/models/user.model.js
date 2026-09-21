import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },
    isVerified: { type: Boolean, default: false },
    // Access tokens issued before this moment are rejected (used by password reset).
    passwordChangedAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 12);
  this.passwordChangedAt = new Date();
};

userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

/** Only ever send these fields to clients. */
userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: String(this._id),
    name: this.name,
    email: this.email,
    role: this.role,
    isVerified: this.isVerified,
    createdAt: this.createdAt,
  };
};

/** What other people are allowed to see about an author. */
userSchema.methods.toAuthorJSON = function toAuthorJSON() {
  return { id: String(this._id), name: this.name, role: this.role };
};

export const User = mongoose.model("User", userSchema);

export function authorJSON(user) {
  if (!user) return null;
  if (typeof user.toAuthorJSON === "function") return user.toAuthorJSON();
  return { id: String(user._id ?? user), name: user.name ?? "Unknown", role: user.role ?? "user" };
}
