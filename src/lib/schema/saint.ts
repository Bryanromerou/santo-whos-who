import { z } from "zod";
import { REVIEW_STATUSES } from "@/db/schema";
import { characteristicTypeSchema, portraitSettingsSchema } from "./library";

z.config(z.locales.es());

const optionalInt = (label: string) =>
  z
    .number({ error: `${label}: escribe un número entero o déjalo vacío` })
    .int({ error: `${label}: debe ser un número entero` })
    .nullable();

/** Payload accepted when creating or saving a saint from the editor. */
export const saintInputSchema = z
  .object({
    name: z.string().trim().min(1, { error: "El nombre es obligatorio" }).max(200),
    birthYear: optionalInt("Año de nacimiento"),
    birthYearDisplay: z.string().max(120),
    ageAtDeath: optionalInt("Edad al morir").refine((v) => v === null || (v >= 0 && v <= 130), {
      error: "Edad al morir debe estar entre 0 y 130",
    }),
    ageAtDeathDisplay: z.string().max(120),
    country: z.string().max(200),
    canonizationYear: optionalInt("Año de canonización"),
    isMartyr: z.boolean(),
    reviewStatus: z.enum(REVIEW_STATUSES),
    categories: z.array(z.string().trim().min(1).max(80)).max(50),
    patronages: z.array(z.string().trim().min(1, { error: "El patronazgo no puede estar vacío" }).max(300)).max(50),
    sources: z.array(z.string().trim().min(1, { error: "La fuente no puede estar vacía" }).max(2000)).max(100),
    characteristics: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(120),
          text: z.string().trim().min(1, { error: "La característica no puede estar vacía" }).max(2000),
          type: characteristicTypeSchema,
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
        ctx.addIssue({ code: "custom", path: ["characteristics", i, "id"], message: "Id de característica repetido" });
      }
      seen.add(c.id);
    });
  });

export type SaintInput = z.infer<typeof saintInputSchema>;
