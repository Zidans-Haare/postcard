import rateLimit from "express-rate-limit";
import { config } from "../config";

export const uploadLimiter = rateLimit({
  windowMs: config.rateLimits.upload.windowMs,
  max: config.rateLimits.upload.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Zu viele Uploads. Bitte später erneut versuchen." },
  keyGenerator: (req) => req.ip,
});

export const loginLimiter = rateLimit({
  windowMs: config.rateLimits.login.windowMs,
  max: config.rateLimits.login.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Zu viele Loginversuche. Bitte warte einen Moment." },
  keyGenerator: (req) => req.ip,
});
