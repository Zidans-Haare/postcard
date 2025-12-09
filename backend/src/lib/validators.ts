import { z } from "zod";
import { config } from "../config";

const FACULTIES = [
  "Informatik/Mathematik",
  "Wirtschaftswissenschaften",
  "Maschinenbau/Verfahrenstechnik",
  "Elektrotechnik",
  "Design",
  "Andere",
] as const;

export const uploadFieldsSchema = z.object({
  fullName: z
    .string({ required_error: "Voller Name ist erforderlich." })
    .min(1, "Voller Name ist erforderlich.")
    .max(200, "Name ist zu lang."),
  email: z
    .string({ required_error: "E-Mail ist erforderlich." })
    .email("Bitte eine gültige E-Mail-Adresse angeben."),
  faculty: z
    .enum(FACULTIES, {
      invalid_type_error: "Ungültige Fakultät.",
      required_error: "Fakultät auswählen.",
    })
    .optional(),
  location: z.string().max(200, "Ort/Uni ist zu lang.").optional(),
  term: z.string().max(100, "Zeitraum ist zu lang.").optional(),
  message: z
    .string()
    .max(1000, "Kurztext darf höchstens 1000 Zeichen enthalten.")
    .optional()
    .transform((value) => (value ? value.trim() : undefined)),
  agree: z.literal("true", {
    errorMap: () => ({ message: "Einwilligung erforderlich." }),
  }),
  raffle: z.enum(["true", "false"]).optional(),
});

export const loginSchema = z.object({
  username: z
    .string({ required_error: "Benutzername erforderlich." })
    .min(1, "Benutzername erforderlich."),
  password: z
    .string({ required_error: "Passwort erforderlich." })
    .min(1, "Passwort erforderlich."),
});

export const statusSchema = z.object({
  status: z.enum(["approved", "received", "deleted"], {
    errorMap: () => ({ message: "Ungültiger Status." }),
  }),
});

export const querySchema = z.object({
  query: z.string().optional(),
  faculty: z.string().optional(),
  status: z
    .enum(["all", "approved", "received", "deleted"] as const)
    .optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.string().optional(),
  limit: z.string().optional(),
});

export const MAX_FILE_RULES = {
  postcardMaxBytes: config.uploads.maxPostcardSize,
  imageMaxBytes: config.uploads.maxImageSize,
  totalMaxBytes: config.uploads.maxTotalSize,
  maxImages: config.uploads.maxImages,
};
