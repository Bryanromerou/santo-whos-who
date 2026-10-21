import { z } from "zod";
import { REVIEW_STATUSES } from "@/db/schema";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { perLocale, translator } from "@/i18n/translator";
import { librarySchemas, portraitSettingsSchema } from "./library";

function build(locale: Locale) {
  const t = translator(locale, "validation");
  const optionalInt = (label: string) =>
    z
      .number({ error: t("integerOrEmpty", { label }) })
      .int({ error: t("integerLabel", { label }) })
      .nullable();

  /** Payload accepted when creating or saving a saint from the editor. */
  return z
    .object({
      name: z.string().trim().min(1, { error: t("nameRequired") }).max(200),
      birthYear: optionalInt(t("fields.birthYear")),
      birthYearDisplay: z.string().max(120),
      ageAtDeath: optionalInt(t("fields.ageAtDeath")).refine((v) => v === null || (v >= 0 && v <= 130), {
        error: t("ageRange"),
      }),
      ageAtDeathDisplay: z.string().max(120),
      country: z.string().max(200),
      canonizationYear: optionalInt(t("fields.canonizationYear")),
      isMartyr: z.boolean(),
      reviewStatus: z.enum(REVIEW_STATUSES),
      categories: z.array(z.string().trim().min(1).max(80)).max(50),
      patronages: z.array(z.string().trim().min(1, { error: t("patronageEmpty") }).max(300)).max(50),
      sources: z.array(z.string().trim().min(1, { error: t("sourceEmpty") }).max(2000)).max(100),
      characteristics: z
        .array(
          z.object({
            id: z.string().trim().min(1).max(120),
            text: z.string().trim().min(1, { error: t("characteristicEmpty") }).max(2000),
            type: librarySchemas(locale).characteristicType,
          }),
        )
        .max(40),
      portrait: portraitSettingsSchema,
      /** Optimistic concurrency: the `updatedAt` the editor loaded. */
      expectedUpdatedAt: z.string().optional(),
    })
    .superRefine((v, ctx) => {
      const seen = new Set<string>();
      v.characteristics.forEach((c, i) => {
        if (seen.has(c.id)) {
          ctx.addIssue({ code: "custom", path: ["characteristics", i, "id"], message: t("characteristicIdRepeated") });
        }
        seen.add(c.id);
      });
    });
}

/** Editor payload schema with messages in the given interface language. */
export const saintInputSchemaFor = perLocale(build);
export const saintInputSchema = saintInputSchemaFor(DEFAULT_LOCALE);

export type SaintInput = z.infer<typeof saintInputSchema>;
