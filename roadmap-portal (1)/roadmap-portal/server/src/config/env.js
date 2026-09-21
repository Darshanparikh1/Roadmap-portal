import "dotenv/config";
import { z } from "zod";

/**
 * Every setting the server reads, validated once at boot.
 * A typo in .env fails here with a clear message instead of surfacing as a bug later.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),

  MONGODB_URI: z.string().min(1).default("mongodb://127.0.0.1:27018/roadmap_portal"),
  // Host for the throwaway databases the test suites create (no database name).
  MONGODB_TEST_URI: z.string().min(1).default("mongodb://127.0.0.1:27018"),

  // Pair-token auth
  JWT_ACCESS_SECRET: z.string().min(16).default("dev-only-access-secret-change-me-please"),
  JWT_REFRESH_SECRET: z.string().min(16).default("dev-only-refresh-secret-change-me-please"),
  ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  // Two tabs refreshing at the same instant present the same token; that is a race, not theft.
  REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().nonnegative().default(10),

  COOKIE_SECURE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
  COOKIE_DOMAIN: z.string().optional(),

  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:5173")
    .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),

  // Email is simulated: messages are stored and shown in the app's dev inbox.
  EMAIL_SIMULATION: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  EMAIL_VERIFICATION_TTL_HOURS: z.coerce.number().int().positive().default(24),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),

  RATE_LIMIT_ENABLED: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().positive().default(5),

  // "auto" uses a MongoDB text index and falls back to regex if the deployment has none.
  SEARCH_MODE: z.enum(["auto", "text", "regex"]).default("auto"),

  ADMIN_EMAIL: z.string().email().default("admin@roadmap.dev"),
  ADMIN_PASSWORD: z.string().min(8).default("Admin@12345"),
  ADMIN_NAME: z.string().default("Product Team"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:\n", z.prettifyError ? z.prettifyError(parsed.error) : parsed.error.issues);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";

if (isProd) {
  const weak = [env.JWT_ACCESS_SECRET, env.JWT_REFRESH_SECRET].some((s) => s.startsWith("dev-only"));
  if (weak) {
    console.error("Refusing to start: set real JWT secrets in production.");
    process.exit(1);
  }
  if (!env.COOKIE_SECURE) {
    console.error("Refusing to start: COOKIE_SECURE must be true in production.");
    process.exit(1);
  }
}

/** Dev-only endpoints (the simulated mailbox) are off in production. */
export const devToolsEnabled = env.EMAIL_SIMULATION && env.NODE_ENV !== "production";
