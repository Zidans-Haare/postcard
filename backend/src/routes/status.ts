import express, { type Router } from "express";
import { HttpError } from "../lib/errors";
import { getFilePath, getRecentEntries, loadMeta } from "../lib/storage";
import { statusLimiter } from "../middleware/rateLimit";

const statusRouter: Router = express.Router();

statusRouter.use(statusLimiter);

statusRouter.get("/recent", async (_req, res, next) => {
  try {
    const entries = await getRecentEntries(6);
    res.json({
      ok: true,
      items: entries.map((entry) => ({
        ref: entry.ref,
        receivedAt: entry.receivedAt,
        location: entry.fields.location ?? null,
        postcardAvailable: Boolean(entry.files.postcard),
      })),
    });
  } catch (error) {
    next(error);
  }
});

statusRouter.get("/:ref/postcard", async (req, res, next) => {
  try {
    const ref = req.params.ref.toUpperCase();
    const meta = await loadMeta(ref);
    if (!meta) {
      throw new HttpError(404, "Referenz wurde nicht gefunden.");
    }
    if (!meta.files.postcard) {
      throw new HttpError(404, "Postkarte wurde nicht gefunden.");
    }
    const result = await getFilePath(ref, meta.files.postcard);
    if (!result) {
      throw new HttpError(404, "Postkarte wurde nicht gefunden.");
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${meta.files.postcard}"`
    );
    res.sendFile(result.path);
  } catch (error) {
    next(error);
  }
});

statusRouter.get("/:ref", async (req, res, next) => {
  try {
    const ref = req.params.ref.toUpperCase();
    const meta = await loadMeta(ref);
    if (!meta) {
      throw new HttpError(404, "Referenz wurde nicht gefunden.");
    }

    res.json({
      ok: true,
      ref: meta.ref,
      status: meta.status,
      receivedAt: meta.receivedAt,
      approvedAt: meta.approvedAt ?? null,
      deletedAt: meta.deletedAt ?? null,
    });
  } catch (error) {
    next(error);
  }
});

export default statusRouter;
