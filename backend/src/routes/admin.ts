import express, { type Router } from "express";
import archiver from "archiver";
import { join } from "node:path";
import { HttpError } from "../lib/errors";
import { requireAdmin, noCache } from "../middleware/auth";
import {
  exportAsCsv,
  exportAsJson,
  findEntry,
  getFilePath,
  listEntries,
  loadMeta,
  updateStatus,
} from "../lib/storage";
import { querySchema, statusSchema } from "../lib/validators";

const adminRouter: Router = express.Router();

function detectMime(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

adminRouter.use(requireAdmin, noCache);

adminRouter.get("/entries", async (req, res, next) => {
  try {
    const parsed = querySchema.parse(req.query);
    const page = Math.max(1, Number(parsed.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(parsed.limit ?? 25)));
    const filter = {
      query: parsed.query?.trim() || undefined,
      faculty: parsed.faculty?.trim() || undefined,
      status: parsed.status || undefined,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
    } as const;

    const entries = await listEntries(filter);
    const total = entries.length;
    const pages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const items = entries.slice(offset, offset + limit).map((entry) => ({
      ref: entry.ref,
      receivedAt: entry.receivedAt,
      status: entry.status,
      consent: entry.consent,
      fields: entry.fields,
      counts: {
        images: entry.files.images.length,
        nFiles: entry.files.images.length + 1,
      },
      hasPdf: Boolean(entry.files.postcard),
    }));

    res.json({ ok: true, items, total, page, pages });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/entries/:ref", async (req, res, next) => {
  try {
    const meta = await loadMeta(req.params.ref);
    if (!meta) {
      throw new HttpError(404, "Eintrag wurde nicht gefunden.");
    }
    res.json({ ok: true, meta, files: meta.files });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/entries/:ref/files/:file", async (req, res, next) => {
  try {
    const fileName = req.params.file;
    const result = await getFilePath(req.params.ref, fileName);
    if (!result) {
      throw new HttpError(404, "Datei nicht gefunden.");
    }
    res.setHeader("Content-Type", detectMime(fileName));
    res.setHeader("Content-Disposition", "inline; filename=\"" + fileName + "\"");
    res.sendFile(result.path);
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/entries/:ref/download/zip", async (req, res, next) => {
  try {
    const summary = await findEntry(req.params.ref);
    const meta = await loadMeta(req.params.ref);
    if (!summary || !meta) {
      throw new HttpError(404, "Eintrag wurde nicht gefunden.");
    }

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${meta.ref}_postkarte.zip"`
    );

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (err) => {
      next(err);
    });

    archive.pipe(res);

    archive.append(JSON.stringify(meta, null, 2), { name: "meta.json" });
    archive.file(join(summary.path, meta.files.postcard), {
      name: meta.files.postcard,
    });

    for (const image of meta.files.images) {
      archive.file(join(summary.path, image), { name: image });
    }

    archive.finalize();
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/entries/:ref/status", async (req, res, next) => {
  try {
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new HttpError(400, issue.message);
    }
    const updated = await updateStatus(req.params.ref, parsed.data.status);
    if (!updated) {
      throw new HttpError(404, "Eintrag wurde nicht gefunden.");
    }
    res.json({ ok: true, meta: updated });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/export.csv", async (req, res, next) => {
  try {
    const parsed = querySchema.parse(req.query);
    const filter = {
      query: parsed.query?.trim() || undefined,
      faculty: parsed.faculty?.trim() || undefined,
      status: parsed.status || undefined,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
    } as const;

    const csv = await exportAsCsv(filter);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=\"postkarten.csv\"");
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/export.json", async (req, res, next) => {
  try {
    const parsed = querySchema.parse(req.query);
    const filter = {
      query: parsed.query?.trim() || undefined,
      faculty: parsed.faculty?.trim() || undefined,
      status: parsed.status || undefined,
      from: parsed.from ? new Date(parsed.from) : undefined,
      to: parsed.to ? new Date(parsed.to) : undefined,
    } as const;

    const data = await exportAsJson(filter);
    res.setHeader("Content-Type", "application/json");
    res.json({ ok: true, items: data });
  } catch (error) {
    next(error);
  }
});

export default adminRouter;
