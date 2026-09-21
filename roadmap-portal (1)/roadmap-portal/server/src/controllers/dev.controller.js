import { devToolsEnabled } from "../config/env.js";
import { ApiError, asyncHandler } from "../utils/api-error.js";
import { OutboxEmail } from "../models/token.model.js";

/** Simulated inbox. 404s when EMAIL_SIMULATION=false or NODE_ENV=production. */
export const mailbox = asyncHandler(async (req, res) => {
  if (!devToolsEnabled) throw ApiError.notFound();
  const filter = req.query.email ? { to: String(req.query.email).toLowerCase() } : {};
  const emails = await OutboxEmail.find(filter).sort({ createdAt: -1 }).limit(25);
  res.json(
    emails.map((m) => ({
      id: String(m._id),
      to: m.to,
      subject: m.subject,
      body: m.body,
      actionUrl: m.actionUrl ?? null,
      createdAt: m.createdAt,
    })),
  );
});
