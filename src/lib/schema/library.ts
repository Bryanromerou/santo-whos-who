import { z } from "zod";
import { CHARACTERISTIC_TYPES, PORTRAIT_FITS, REVIEW_STATUSES } from "@/db/schema";

// Spanish messages for generic Zod issues (custom messages below take priority).
z.config(z.locales.es());

export const LIBRARY_FORMAT = "santos-studio-library";
export const LIBRARY_SCHEMA_VERSION = 1;

const nonBlank = (msg: string) =>
  z.string({ error: msg }).refine((s) => s.trim().length > 0, { error: msg });

const intOrNull = (label: string) =>
  z.number({ error: `${label} debe ser un número entero o null` }).int({ error: `${label} debe ser un número entero` }).nullable();

export const characteristicTypeSchema = z.enum(CHARACTERISTIC_TYPES, {
  error: `Tipo no válido. Valores permitidos: ${CHARACTERISTIC_TYPES.join(", ")}`,
});

export const characteristicSchema = z.object({
  id: nonBlank("Cada característica necesita un id"),
  text: nonBlank("El texto de la característica no puede estar vacío"),
  type: characteristicTypeSchema,
});

/** Optional extension (not in the original file): non-destructive crop settings. */
export const portraitSettingsSchema = z.object({
  focalX: z.number().min(0).max(100).default(50),
  focalY: z.number().min(0).max(100).default(50),
  zoom: z.number().min(1).max(4).default(1),
  fit: z.enum(PORTRAIT_FITS).default("cover"),
});

export const librarySaintSchema = z.object({
  id: nonBlank("Cada santo necesita un id"),
  name: nonBlank("El nombre del santo es obligatorio"),
  birthYear: intOrNull("birthYear"),
  birthYearDisplay: z.string().default(""),
  ageAtDeath: intOrNull("ageAtDeath"),
  ageAtDeathDisplay: z.string().default(""),
  country: z.string().default(""),
  portraitPath: z.string().nullable().default(null),
  isMartyr: z.boolean({ error: "isMartyr debe ser true o false" }),
  categories: z.array(z.string()).default([]),
  patronages: z.array(z.string()).default([]),
  canonizationYear: intOrNull("canonizationYear").default(null),
  characteristics: z.array(characteristicSchema, { error: "characteristics debe ser una lista" }),
  sources: z.array(z.string()).default([]),
  reviewStatus: z.enum(REVIEW_STATUSES, {
    error: "reviewStatus debe ser \"needs_review\" o \"reviewed\"",
  }),
  portrait: portraitSettingsSchema.optional(),
});

export const libraryCollectionSchema = z.object({
  id: nonBlank("Cada colección necesita un id"),
  name: nonBlank("El nombre de la colección es obligatorio"),
  saintIds: z.array(z.string()),
});

export const librarySourceSchema = z.looseObject({
  document: z.string().nullable().optional(),
  notes: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  factCheckedIndividually: z.boolean().optional(),
});

export const libraryFileSchema = z.object({
  schemaVersion: z.literal(LIBRARY_SCHEMA_VERSION, {
    error: `schemaVersion debe ser ${LIBRARY_SCHEMA_VERSION}`,
  }),
  format: z.literal(LIBRARY_FORMAT, { error: `format debe ser "${LIBRARY_FORMAT}"` }),
  language: z.literal("es", { error: 'language debe ser "es"' }),
  source: librarySourceSchema.default({}),
  saints: z.array(librarySaintSchema, { error: "saints debe ser una lista de santos" }),
  collections: z.array(libraryCollectionSchema).default([]),
});

export type LibraryCharacteristic = z.infer<typeof characteristicSchema>;
export type LibrarySaint = z.infer<typeof librarySaintSchema>;
export type LibraryCollection = z.infer<typeof libraryCollectionSchema>;
export type LibrarySource = z.infer<typeof librarySourceSchema>;
export type LibraryFile = z.infer<typeof libraryFileSchema>;
