import type { Router } from "express";
import express from "express";
import { config } from "../config";
import { loginLimiter } from "../middleware/rateLimit";
import { loginSchema } from "../lib/validators";
import { HttpError } from "../lib/errors";
import { timingSafeCompare } from "../lib/utils";

const authRouter: Router = express.Router();

const failedLoginAttempts = new Map<string, { count: number; lockedUntil?: number }>();
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 Minuten

function getAttempts(username: string) {
  const record = failedLoginAttempts.get(username);
  if (!record) return { count: 0 };
  return record;
}

function registerFailure(username: string) {
  const current = getAttempts(username);
  const count = current.count + 1;
  const lockedUntil =
    count >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_DURATION_MS : current.lockedUntil;
  failedLoginAttempts.set(username, { count, lockedUntil });
}

function resetAttempts(username: string) {
  failedLoginAttempts.delete(username);
}

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new HttpError(400, issue.message);
    }
    const { username, password } = parsed.data;

    const attempts = getAttempts(username);
    if (attempts.lockedUntil && attempts.lockedUntil > Date.now()) {
      const minutes = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
      throw new HttpError(
        429,
        `Zu viele Fehlversuche. Bitte in ${minutes} Minuten erneut probieren.`
      );
    }

    const userMatch = timingSafeCompare(config.adminUser, username);
    const passMatch = timingSafeCompare(config.adminPass, password);

    if (!userMatch || !passMatch) {
      registerFailure(username);
      throw new HttpError(401, "Benutzername oder Passwort ist falsch.");
    }

    resetAttempts(username);

    req.session.regenerate((err) => {
      if (err) {
        next(err);
        return;
      }
      req.session.user = {
        username,
        loggedInAt: new Date().toISOString(),
      };
      req.session.cookie.maxAge = config.session.cookieMaxAge;
      res.json({ ok: true });
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      next(err);
      return;
    }
    res.clearCookie(config.session.name);
    res.json({ ok: true });
  });
});

export default authRouter;
