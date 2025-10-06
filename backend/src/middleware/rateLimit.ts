import type { Request } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../config";

function determineClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return forwarded[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

export const uploadLimiter = rateLimit({
  windowMs: config.rateLimits.upload.windowMs,
  max: config.rateLimits.upload.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Zu viele Uploads. Bitte später erneut versuchen." },
  keyGenerator: (req) => determineClientIp(req),
});

export const loginLimiter = rateLimit({
  windowMs: config.rateLimits.login.windowMs,
  max: config.rateLimits.login.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Zu viele Loginversuche. Bitte warte einen Moment." },
  keyGenerator: (req) => determineClientIp(req),
});

export const statusLimiter = rateLimit({
  windowMs: config.rateLimits.status.windowMs,
  max: config.rateLimits.status.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Zu viele Anfragen. Bitte warte einen Moment." },
  keyGenerator: (req) => determineClientIp(req),
});
