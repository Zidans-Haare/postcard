import express, { type Router } from "express";
import { HttpError } from "../lib/errors";
import { loadMeta } from "../lib/storage";

const statusRouter: Router = express.Router();

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
