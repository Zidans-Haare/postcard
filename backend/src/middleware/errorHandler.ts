import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../lib/errors";

export function errorHandler(err: unknown, _: Request, res: Response, __: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ ok: false, message: err.message });
    return;
  }

  console.error("Unerwarteter Fehler", err);
  res.status(500).json({ ok: false, message: "Interner Serverfehler." });
}
