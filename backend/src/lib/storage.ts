import { createReadStream, promises as fs } from "node:fs";
import type { ReadStream } from "node:fs";
import { join, resolve } from "node:path";
import { config } from "../config";
import type { EntryFields, EntryMeta, EntryStatus, EntrySummary } from "./meta";
import { buildDateSegment, sanitizeFileName } from "./utils";

export interface UploadedFile {
  originalName: string;
  buffer: Buffer;
  size: number;
  mimeType: string;
}

export interface SaveEntryPayload {
  ref: string;
  receivedAt: Date;
  fields: EntryFields;
  consent: boolean;
  postcard: UploadedFile;
  images: UploadedFile[];
}

export interface ListFilter {
  query?: string;
  faculty?: string;
  status?: EntryStatus | "all";
  from?: Date;
  to?: Date;
}

async function ensureDir(path: string) {
  await fs.mkdir(path, { recursive: true });
}

function addTimestampSuffix(fileName: string, epochSeconds: number, fallbackBase: string): string {
  const sanitized = sanitizeFileName(fileName);
  const segments = sanitized.split(".");
  const ext = segments.length > 1 ? `.${segments.pop()}` : "";
  const base = segments.join(".") || fallbackBase;
  return `${base}_${epochSeconds}${ext}`;
}

async function writeFile(filePath: string, data: Buffer) {
  await fs.writeFile(filePath, data);
}

function directoryFor(receivedAt: Date, ref: string): string {
  const daySegment = buildDateSegment(receivedAt);
  return resolve(config.uploadDir, daySegment, ref);
}

export async function saveEntry(payload: SaveEntryPayload): Promise<EntryMeta> {
  const epoch = Math.floor(payload.receivedAt.getTime() / 1000);
  const dir = directoryFor(payload.receivedAt, payload.ref);
  await ensureDir(dir);

  const postcardName = addTimestampSuffix(
    payload.postcard.originalName || "Postkarte.pdf",
    epoch,
    "Postkarte"
  );
  const postcardPath = join(dir, postcardName);
  await writeFile(postcardPath, payload.postcard.buffer);

  const imageNames: string[] = [];
  for (const [index, image] of payload.images.entries()) {
    const postfixEpoch = epoch + index + 1;
    const imageName = addTimestampSuffix(
      image.originalName || `Bild_${index + 1}.jpg`,
      postfixEpoch,
      `Bild_${index + 1}`
    );
    const imagePath = join(dir, imageName);
    await writeFile(imagePath, image.buffer);
    imageNames.push(imageName);
  }

  const meta: EntryMeta = {
    ref: payload.ref,
    receivedAt: payload.receivedAt.toISOString(),
    status: "received",
    consent: payload.consent,
    fields: payload.fields,
    files: {
      postcard: postcardName,
      images: imageNames,
    },
  };

  await fs.writeFile(join(dir, "meta.json"), JSON.stringify(meta, null, 2), {
    encoding: "utf-8",
  });

  return meta;
}

async function readMetaFromPath(dir: string): Promise<EntrySummary | null> {
  const metaPath = join(dir, "meta.json");
  try {
    const content = await fs.readFile(metaPath, "utf-8");
    const meta = JSON.parse(content) as EntryMeta;
    return { ...meta, path: dir };
  } catch {
    return null;
  }
}

async function walkEntries(): Promise<EntrySummary[]> {
  await ensureDir(config.uploadDir);
  const days = await fs.readdir(config.uploadDir, { withFileTypes: true }).catch(() => []);
  const summaries: EntrySummary[] = [];

  for (const day of days) {
    if (!day.isDirectory()) continue;
    const dayPath = join(config.uploadDir, day.name);
    const entries = await fs.readdir(dayPath, { withFileTypes: true }).catch(() => []);
    for (const entryDir of entries) {
      if (!entryDir.isDirectory()) continue;
      const entryPath = join(dayPath, entryDir.name);
      const summary = await readMetaFromPath(entryPath);
      if (summary) {
        summaries.push(summary);
      }
    }
  }

  return summaries;
}

function matchesFilter(meta: EntrySummary, filter: ListFilter): boolean {
  if (filter.status && filter.status !== "all" && meta.status !== filter.status) {
    return false;
  }

  if (filter.faculty) {
    if ((meta.fields.faculty || "").toLowerCase() !== filter.faculty.toLowerCase()) {
      return false;
    }
  }

  if (filter.query) {
    const search = filter.query.toLowerCase();
    const haystack = [
      meta.ref,
      meta.fields.fullName,
      meta.fields.email,
      meta.fields.location,
      meta.fields.term,
      meta.fields.message,
    ]
      .filter(Boolean)
      .map((value) => value!.toLowerCase());
    if (!haystack.some((value) => value.includes(search))) {
      return false;
    }
  }

  if (filter.from) {
    if (new Date(meta.receivedAt).getTime() < filter.from.getTime()) {
      return false;
    }
  }

  if (filter.to) {
    if (new Date(meta.receivedAt).getTime() > filter.to.getTime()) {
      return false;
    }
  }

  return true;
}

export async function listEntries(filter: ListFilter = {}): Promise<EntrySummary[]> {
  const entries = await walkEntries();
  const filtered = entries.filter((meta) => matchesFilter(meta, filter));
  filtered.sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
  return filtered;
}

export async function findEntry(ref: string): Promise<EntrySummary | null> {
  const entries = await walkEntries();
  return entries.find((entry) => entry.ref === ref) ?? null;
}

export async function loadMeta(ref: string): Promise<EntryMeta | null> {
  const entry = await findEntry(ref);
  if (!entry) return null;
  const metaPath = join(entry.path, "meta.json");
  try {
    const content = await fs.readFile(metaPath, "utf-8");
    return JSON.parse(content) as EntryMeta;
  } catch {
    return null;
  }
}

export async function writeMeta(ref: string, meta: EntryMeta): Promise<void> {
  const entry = await findEntry(ref);
  if (!entry) throw new Error("Eintrag nicht gefunden");
  const metaPath = join(entry.path, "meta.json");
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf-8");
}

export async function updateStatus(ref: string, status: EntryStatus): Promise<EntryMeta | null> {
  const existing = await loadMeta(ref);
  if (!existing) {
    return null;
  }
  const updated: EntryMeta = {
    ...existing,
    status,
  };
  const nowIso = new Date().toISOString();
  if (status === "approved") {
    updated.approvedAt = nowIso;
    updated.deletedAt = undefined;
  }
  if (status === "deleted") {
    updated.deletedAt = nowIso;
  }
  if (status === "received") {
    updated.deletedAt = undefined;
    updated.approvedAt = undefined;
  }
  await writeMeta(ref, updated);
  return updated;
}

export async function fileStream(ref: string, fileName: string): Promise<{ stream: ReadStream; meta: EntrySummary } | null> {
  const entry = await findEntry(ref);
  if (!entry) {
    return null;
  }
  const allowedFiles = [entry.files.postcard, ...entry.files.images];
  if (!allowedFiles.includes(fileName)) {
    return null;
  }
  const filePath = join(entry.path, fileName);
  const exists = await fs
    .stat(filePath)
    .then((stats) => stats.isFile())
    .catch(() => false);
  if (!exists) {
    return null;
  }
  return { stream: createReadStream(filePath), meta: entry };
}

export async function getFilePath(ref: string, fileName: string): Promise<{ path: string; meta: EntrySummary } | null> {
  const entry = await findEntry(ref);
  if (!entry) return null;
  const allowedFiles = [entry.files.postcard, ...entry.files.images];
  if (!allowedFiles.includes(fileName)) {
    return null;
  }
  const filePath = join(entry.path, fileName);
  const exists = await fs
    .stat(filePath)
    .then((stats) => stats.isFile())
    .catch(() => false);
  if (!exists) return null;
  return { path: filePath, meta: entry };
}

export async function exportAsJson(filter: ListFilter = {}): Promise<EntryMeta[]> {
  const entries = await listEntries(filter);
  const metas: EntryMeta[] = [];
  for (const entry of entries) {
    const meta = await loadMeta(entry.ref);
    if (meta) metas.push(meta);
  }
  return metas;
}

const CSV_HEADERS = [
  "ref",
  "receivedAt",
  "status",
  "fullName",
  "email",
  "faculty",
  "role",
  "location",
  "term",
  "message",
  "consent",
  "postcard",
  "images",
];

function escapeCsv(value: string | undefined | null): string {
  if (value === undefined || value === null) {
    return "";
  }
  const stringValue = String(value);
  if (stringValue.includes(";") || stringValue.includes("\n") || stringValue.includes('"')) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  return stringValue;
}

export async function exportAsCsv(filter: ListFilter = {}): Promise<string> {
  const entries = await exportAsJson(filter);
  const lines = [CSV_HEADERS.join(";")];
  for (const meta of entries) {
    const row = [
      meta.ref,
      meta.receivedAt,
      meta.status,
      meta.fields.fullName,
      meta.fields.email,
      meta.fields.faculty ?? "",
      meta.fields.role,
      meta.fields.location ?? "",
      meta.fields.term ?? "",
      meta.fields.message ?? "",
      meta.consent ? "true" : "false",
      meta.files.postcard,
      meta.files.images.join(","),
    ].map(escapeCsv);
    lines.push(row.join(";"));
  }
  return lines.join("\n");
}
