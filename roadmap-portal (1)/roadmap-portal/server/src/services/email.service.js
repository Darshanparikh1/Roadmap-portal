import { env } from "../config/env.js";
import { OutboxEmail } from "../models/token.model.js";

/**
 * Email delivery is simulated: messages are stored in `outbox_emails` and logged, so the
 * verification and reset flows are fully testable without SMTP credentials.
 * Swapping in a provider (SES, Resend, Nodemailer) means changing this one function.
 */
export async function sendEmail({ to, subject, body, actionUrl }) {
  await OutboxEmail.create({ to, subject, body, actionUrl });
  if (env.NODE_ENV !== "test") {
    console.log(`[simulated email] to=${to} subject="${subject}" link=${actionUrl ?? "-"}`);
  }
}

export function sendVerificationEmail({ to, name, rawToken }) {
  return sendEmail({
    to,
    subject: "Confirm your email address",
    body: `Hi ${name},\n\nConfirm your email to start posting, voting and commenting.\nThis link expires in ${env.EMAIL_VERIFICATION_TTL_HOURS} hours.`,
    actionUrl: `${env.CLIENT_URL}/verify-email?token=${rawToken}`,
  });
}

export function sendPasswordResetEmail({ to, name, rawToken }) {
  return sendEmail({
    to,
    subject: "Reset your password",
    body: `Hi ${name},\n\nUse the link below to choose a new password. It works once and expires in ${env.PASSWORD_RESET_TTL_MINUTES} minutes.\nIf you didn't ask for this, you can ignore this email.`,
    actionUrl: `${env.CLIENT_URL}/reset-password?token=${rawToken}`,
  });
}
