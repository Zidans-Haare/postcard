import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv();

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  ALLOW_ORIGIN_FRONTEND: z.string().url(),
  ALLOW_ORIGIN_ADMIN: z.string().url(),
  EXTRA_ALLOWED_ORIGINS: z.string().optional(),
  UPLOAD_DIR: z.string().default("./uploads"),
  ADMIN_USER: z.string().min(3),
  ADMIN_PASS: z.string().min(8),
  SESSION_SECRET: z.string().min(16),
  SESSION_NAME: z.string().default("postkarte.sid"),
  RETENTION_MONTHS: z.coerce.number().int().positive().optional(),
});

const parsed = envSchema.parse({
  ...process.env,
  SESSION_SECRET:
    process.env.SESSION_SECRET ?? randomBytes(32).toString("hex"),
});

export const config = {
  env: parsed.NODE_ENV,
  port: parsed.PORT,
  allowOrigins: Array.from(
    new Set(
      [
        parsed.ALLOW_ORIGIN_FRONTEND,
        parsed.ALLOW_ORIGIN_ADMIN,
        ...(parsed.EXTRA_ALLOWED_ORIGINS
          ? parsed.EXTRA_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
          : []),
      ].filter(Boolean)
    )
  ),
  uploadDir: resolve(parsed.UPLOAD_DIR),
  adminUser: parsed.ADMIN_USER,
  adminPass: parsed.ADMIN_PASS,
  session: {
    name: parsed.SESSION_NAME,
    secret: parsed.SESSION_SECRET,
    cookieMaxAge: 1000 * 60 * 60 * 8, // 8 Stunden
  },
  retentionMonths: parsed.RETENTION_MONTHS,
  uploads: {
    maxImages: 5,
    maxImageSize: 8 * 1024 * 1024,
    maxPostcardSize: 10 * 1024 * 1024,
    maxTotalSize: 30 * 1024 * 1024,
    allowedPostcardMime: "application/pdf",
  },
  rateLimits: {
    login: {
      windowMs: 60_000,
      max: 10,
    },
    upload: {
      windowMs: 60_000,
      max: 30,
    },
    status: {
      windowMs: 60_000,
      max: 120,
    },
  },
};
