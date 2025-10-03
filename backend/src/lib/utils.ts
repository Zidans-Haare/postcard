import { randomBytes, timingSafeEqual } from "node:crypto";

const SAFE_FILENAME_REGEX = /[^a-zA-Z0-9._-]+/g;

export function generateReference(): string {
  return randomBytes(4).toString("hex").toUpperCase();
}

export function sanitizeFileName(filename: string): string {
  const cleaned = filename.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const segments = cleaned.split(".");
  const ext = segments.length > 1 ? `.${segments.pop()!.toLowerCase()}` : "";
  const base = segments.join(".").replace(SAFE_FILENAME_REGEX, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "");
  const safeBase = base.length === 0 ? "datei" : base;
  return `${safeBase}${ext}`;
}

export function buildDateSegment(date: Date): string {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

const EMAIL_REGEX = /^(?:[a-zA-Z0-9_'^&+{}=\-](?:\.?[a-zA-Z0-9_'^&+{}=\-])*)@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;

export function isEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

export function timingSafeCompare(expected: string, received: string): boolean {
  const expectedBuffer = Buffer.from(expected, "utf-8");
  const receivedBuffer = Buffer.from(received, "utf-8");
  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}
