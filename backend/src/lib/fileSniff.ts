import type { UploadedFile } from "./storage";

const PDF_MAGIC = Buffer.from("%PDF-", "ascii");
const JPG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF_MAGIC_1 = Buffer.from("GIF87a", "ascii");
const GIF_MAGIC_2 = Buffer.from("GIF89a", "ascii");
const WEBP_RIFF = Buffer.from("RIFF", "ascii");
const WEBP_WEBP = Buffer.from("WEBP", "ascii");

function hasPrefix(buffer: Buffer, prefix: Buffer): boolean {
  if (buffer.length < prefix.length) {
    return false;
  }
  return buffer.subarray(0, prefix.length).equals(prefix);
}

export function isPdfFile(file: UploadedFile): boolean {
  if (!hasPrefix(file.buffer, PDF_MAGIC)) {
    return false;
  }
  const trailerSearchLength = Math.min(file.buffer.length, 2048);
  const trailer = file.buffer.subarray(file.buffer.length - trailerSearchLength).toString("ascii");
  return trailer.includes("%%EOF");
}

function looksLikeJpeg(buffer: Buffer): boolean {
  if (buffer.length < 4) {
    return false;
  }
  if (!hasPrefix(buffer, JPG_MAGIC)) {
    return false;
  }
  const lastByte = buffer[buffer.length - 1];
  const secondLastByte = buffer[buffer.length - 2];
  return lastByte === 0xd9 && secondLastByte === 0xff;
}

function looksLikePng(buffer: Buffer): boolean {
  return hasPrefix(buffer, PNG_MAGIC);
}

function looksLikeGif(buffer: Buffer): boolean {
  return hasPrefix(buffer, GIF_MAGIC_1) || hasPrefix(buffer, GIF_MAGIC_2);
}

function looksLikeWebp(buffer: Buffer): boolean {
  if (buffer.length < 12) {
    return false;
  }
  return (
    hasPrefix(buffer, WEBP_RIFF) &&
    buffer.subarray(8, 12).equals(WEBP_WEBP)
  );
}

export function isSupportedImage(file: UploadedFile): boolean {
  const { buffer, mimeType } = file;
  if (mimeType === "image/png") {
    return looksLikePng(buffer);
  }
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    return looksLikeJpeg(buffer);
  }
  if (mimeType === "image/gif") {
    return looksLikeGif(buffer);
  }
  if (mimeType === "image/webp") {
    return looksLikeWebp(buffer);
  }

  if (mimeType.startsWith("image/")) {
    return looksLikePng(buffer) || looksLikeJpeg(buffer) || looksLikeGif(buffer) || looksLikeWebp(buffer);
  }

  return false;
}
