import type { Request, Response, NextFunction } from "express";

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.session?.user) {
    return next();
  }
  res.status(401).json({ ok: false, message: "Nicht eingeloggt." });
}

export function noCache(_: Request, res: Response, next: NextFunction) {
  res.setHeader("Cache-Control", "no-store, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
}
