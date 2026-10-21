import { z } from "zod";
import { CHARACTERISTIC_TYPES, REVIEW_STATUSES } from "@/db/schema";
import type { SaintRecord } from "@/db/repositories/saints";
import type { LooseT } from "@/i18n/loose";
import type { SaintInput } from "@/lib/schema/saint";

/**
 * Form values: numbers are edited as text so empty means null (never 0).
 * `t` is the "validation" translator, so messages follow the interface language.
 */
export function buildSaintFormSchema(t: LooseT) {
  const yearText = (label: string) => z.string().trim().regex(/^-?\d{0,4}$/, { error: t("yearDigits", { label }) });
  return z.object({
    name: z.string().trim().min(1, { error: t("nameRequired") }).max(200),
    birthYear: yearText(t("fields.birthYear")),
    birthYearDisplay: z.string().max(120),
    ageAtDeath: z.string().trim().regex(/^\d{0,3}$/, { error: t("ageDigits") }),
    ageAtDeathDisplay: z.string().max(120),
    country: z.string().max(200),
    canonizationYear: yearText(t("fields.canonizationYear")),
    isMartyr: z.boolean(),
    reviewStatus: z.enum(REVIEW_STATUSES),
    categories: z.array(z.string()),
    patronages: z.array(z.object({ value: z.string().trim().min(1, { error: t("patronageRequired") }) })),
    sources: z.array(z.object({ value: z.string().trim().min(1, { error: t("sourceRequired") }) })),
    characteristics: z.array(
      z.object({
        id: z.string().min(1),
        text: z.string().trim().min(1, { error: t("characteristicRequired") }),
        type: z.enum(CHARACTERISTIC_TYPES),
      }),
    ),
    portrait: z.object({ focalX: z.number(), focalY: z.number(), zoom: z.number(), fit: z.enum(["cover", "contain"]) }),
  });
}

export type SaintFormValues = z.infer<ReturnType<typeof buildSaintFormSchema>>;

const numOrNull = (s: string) => (s.trim() === "" ? null : Number.parseInt(s, 10));

export function emptyForm(): SaintFormValues {
  return {
    name: "",
    birthYear: "",
    birthYearDisplay: "",
    ageAtDeath: "",
    ageAtDeathDisplay: "",
    country: "",
    canonizationYear: "",
    isMartyr: false,
    reviewStatus: "needs_review",
    categories: [],
    patronages: [],
    sources: [],
    characteristics: [],
    portrait: { focalX: 50, focalY: 50, zoom: 1, fit: "cover" },
  };
}

export function recordToForm(s: SaintRecord): SaintFormValues {
  return {
    name: s.name,
    birthYear: s.birthYear === null ? "" : String(s.birthYear),
    birthYearDisplay: s.birthYearDisplay,
    ageAtDeath: s.ageAtDeath === null ? "" : String(s.ageAtDeath),
    ageAtDeathDisplay: s.ageAtDeathDisplay,
    country: s.country,
    canonizationYear: s.canonizationYear === null ? "" : String(s.canonizationYear),
    isMartyr: s.isMartyr,
    reviewStatus: s.reviewStatus,
    categories: [...s.categories],
    patronages: s.patronages.map((value) => ({ value })),
    sources: s.sources.map((value) => ({ value })),
    characteristics: s.characteristics.map((c) => ({ ...c })),
    portrait: { ...s.portrait },
  };
}

/**
 * Converts form values to the API payload. Characteristic text keeps the
 * user's wording; only surrounding whitespace is trimmed.
 */
export function formToInput(v: SaintFormValues, expectedUpdatedAt?: string): SaintInput {
  return {
    name: v.name.trim(),
    birthYear: numOrNull(v.birthYear),
    birthYearDisplay: v.birthYearDisplay,
    ageAtDeath: numOrNull(v.ageAtDeath),
    ageAtDeathDisplay: v.ageAtDeathDisplay,
    country: v.country,
    canonizationYear: numOrNull(v.canonizationYear),
    isMartyr: v.isMartyr,
    reviewStatus: v.reviewStatus,
    categories: v.categories,
    patronages: v.patronages.map((p) => p.value.trim()),
    sources: v.sources.map((p) => p.value.trim()),
    characteristics: v.characteristics.map((c) => ({ id: c.id, text: c.text.trim(), type: c.type })),
    portrait: v.portrait,
    expectedUpdatedAt,
  };
}
