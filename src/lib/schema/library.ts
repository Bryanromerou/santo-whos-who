import { z } from "zod";
import { CHARACTERISTIC_TYPES, PORTRAIT_FITS, REVIEW_STATUSES } from "@/db/schema";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { perLocale, translator } from "@/i18n/translator";

export const LIBRARY_FORMAT = "santos-studio-library";
export const LIBRARY_SCHEMA_VERSION = 1;

/** Optional extension (not in the original file): non-destructive crop settings. */
export const portraitSettingsSchema = z.object({
  focalX: z.number().min(0).max(100).default(50),
  focalY: z.number().min(0).max(100).default(50),
  zoom: z.number().min(1).max(4).default(1),
  fit: z.enum(PORTRAIT_FITS).default("cover"),
});

export const librarySourceSchema = z.looseObject({
  document: z.string().nullable().optional(),
  notes: z.union([z.string(), z.array(z.string())]).nullable().optional(),
  factCheckedIndividually: z.boolean().optional(),
});

function build(locale: Locale) {
  const t = translator(locale, "validation");
  const nonBlank = (msg: string) => z.string({ error: msg }).refine((s) => s.trim().length > 0, { error: msg });
  const intOrNull = (field: string) =>
    z.number({ error: t("intOrNull", { field }) }).int({ error: t("integerField", { field }) }).nullable();

  const characteristicType = z.enum(CHARACTERISTIC_TYPES, { error: t("typeInvalid", { values: CHARACTERISTIC_TYPES.join(", ") }) });

  const characteristic = z.object({
    id: nonBlank(t("characteristicIdRequired")),
    text: nonBlank(t("characteristicTextRequired")),
    type: characteristicType,
  });

  const saint = z.object({
    id: nonBlank(t("saintIdRequired")),
    name: nonBlank(t("saintNameRequired")),
    birthYear: intOrNull("birthYear"),
    birthYearDisplay: z.string().default(""),
    ageAtDeath: intOrNull("ageAtDeath"),
    ageAtDeathDisplay: z.string().default(""),
    country: z.string().default(""),
    portraitPath: z.string().nullable().default(null),
    isMartyr: z.boolean({ error: t("isMartyrBoolean") }),
    categories: z.array(z.string()).default([]),
    patronages: z.array(z.string()).default([]),
    canonizationYear: intOrNull("canonizationYear").default(null),
    characteristics: z.array(characteristic, { error: t("characteristicsList") }),
    sources: z.array(z.string()).default([]),
    reviewStatus: z.enum(REVIEW_STATUSES, { error: t("reviewStatusInvalid") }),
    portrait: portraitSettingsSchema.optional(),
  });

  const collection = z.object({
    id: nonBlank(t("collectionIdRequired")),
    name: nonBlank(t("collectionNameRequired")),
    saintIds: z.array(z.string()),
  });

  const file = z.object({
    schemaVersion: z.literal(LIBRARY_SCHEMA_VERSION, { error: t("schemaVersionInvalid", { version: LIBRARY_SCHEMA_VERSION }) }),
    format: z.literal(LIBRARY_FORMAT, { error: t("formatInvalid", { format: LIBRARY_FORMAT }) }),
    language: z.literal("es", { error: t("languageInvalid") }),
    source: librarySourceSchema.default({}),
    saints: z.array(saint, { error: t("saintsList") }),
    collections: z.array(collection).default([]),
  });

  return { characteristicType, characteristic, saint, collection, file };
}

/** Library-file schemas with custom messages in the given interface language. */
export const librarySchemas = perLocale(build);

const es = librarySchemas(DEFAULT_LOCALE);
export const characteristicTypeSchema = es.characteristicType;
export const characteristicSchema = es.characteristic;
export const librarySaintSchema = es.saint;
export const libraryCollectionSchema = es.collection;
export const libraryFileSchema = es.file;

export type LibraryCharacteristic = z.infer<typeof characteristicSchema>;
export type LibrarySaint = z.infer<typeof librarySaintSchema>;
export type LibraryCollection = z.infer<typeof libraryCollectionSchema>;
export type LibrarySource = z.infer<typeof librarySourceSchema>;
export type LibraryFile = z.infer<typeof libraryFileSchema>;
