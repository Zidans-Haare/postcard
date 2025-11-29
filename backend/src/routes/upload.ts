import express, { type Router } from "express";
import multer from "multer";
import { config } from "../config";
import { uploadLimiter } from "../middleware/rateLimit";
import { uploadFieldsSchema, MAX_FILE_RULES } from "../lib/validators";
import { HttpError } from "../lib/errors";
import { generateReference } from "../lib/utils";
import { saveEntry, findEntry, type UploadedFile } from "../lib/storage";
import { isPdfFile, isSupportedImage } from "../lib/fileSniff";

const uploadRouter: Router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_RULES.totalMaxBytes,
    files: MAX_FILE_RULES.maxImages + 1,
  },
});

const uploadFields = upload.fields([
  { name: "postcard", maxCount: 1 },
  { name: "images", maxCount: MAX_FILE_RULES.maxImages },
]);

function toUploadedFile(file: Express.Multer.File): UploadedFile {
  return {
    originalName: file.originalname,
    buffer: file.buffer,
    size: file.size,
    mimeType: file.mimetype,
  };
}

async function generateUniqueRef(): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const ref = generateReference();
    const existing = await findEntry(ref);
    if (!existing) {
      return ref;
    }
  }
  throw new HttpError(500, "Referenz konnte nicht erzeugt werden.");
}

uploadRouter.post("/", uploadLimiter, uploadFields, async (req, res, next) => {
  try {
    const parsed = uploadFieldsSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      throw new HttpError(400, issue.message);
    }
    const fields = parsed.data;

    const files = req.files;
    const fileGroups: Record<string, Express.Multer.File[]> =
      files && !Array.isArray(files) ? files : {};

    const postcardFiles = fileGroups.postcard ?? [];
    if (postcardFiles.length !== 1) {
      throw new HttpError(400, "PDF-Datei ist erforderlich.");
    }
    const postcard = postcardFiles[0];
    if (postcard.mimetype !== config.uploads.allowedPostcardMime) {
      throw new HttpError(415, "Die Postkarte muss als PDF hochgeladen werden.");
    }
    if (postcard.size > MAX_FILE_RULES.postcardMaxBytes) {
      throw new HttpError(400, "PDF darf maximal 10 MB groß sein.");
    }
    const postcardFile = toUploadedFile(postcard);
    if (!isPdfFile(postcardFile)) {
      throw new HttpError(415, "Die PDF-Datei ist ungültig oder beschädigt.");
    }

    const imageFiles = (fileGroups.images ?? []).map(toUploadedFile);
    if (imageFiles.length > MAX_FILE_RULES.maxImages) {
      throw new HttpError(400, "Es sind höchstens 5 Bilder erlaubt.");
    }
    for (const image of imageFiles) {
      if (!image.mimeType.startsWith("image/")) {
        throw new HttpError(400, "Bilder müssen ein gültiges Bildformat besitzen.");
      }
      if (image.size > MAX_FILE_RULES.imageMaxBytes) {
        throw new HttpError(400, "Jedes Bild darf höchstens 8 MB haben.");
      }
      if (!isSupportedImage(image)) {
        throw new HttpError(415, "Bilddatei konnte nicht verifiziert werden.");
      }
    }

    const totalSize = postcardFile.size + imageFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > MAX_FILE_RULES.totalMaxBytes) {
      throw new HttpError(413, "Gesamtgröße von 30 MB überschritten.");
    }

    const ref = await generateUniqueRef();

    const meta = await saveEntry({
      ref,
      receivedAt: new Date(),
      consent: fields.agree === "true",
      fields: {
        fullName: fields.fullName.trim(),
        email: fields.email.toLowerCase(),
        faculty: fields.faculty,
        role: "Outgoing",
        location: fields.location?.trim(),
        term: fields.term?.trim(),
        message: fields.message,
      },
      postcard: postcardFile,
      images: imageFiles,
    });

    res.json({
      ok: true,
      ref: meta.ref,
      files: meta.files,
    });
  } catch (error) {
    next(error);
  }
});

export default uploadRouter;
