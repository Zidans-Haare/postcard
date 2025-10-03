import express, { type Router } from "express";
import { HttpError } from "../lib/errors";
import { getRecentEntries, loadMeta } from "../lib/storage";

const statusRouter: Router = express.Router();

statusRouter.get("/recent", async (_req, res, next) => {
  try {
    const entries = await getRecentEntries(6);
    res.json({
      ok: true,
      items: entries.map((entry) => ({
        ref: entry.ref,
        receivedAt: entry.receivedAt,
        status: entry.status,
        fullName: entry.fields.fullName,
        location: entry.fields.location ?? null,
        term: entry.fields.term ?? null,
        faculty: entry.fields.faculty ?? null,
        postcard: entry.files.postcard,
      })),
    });
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
