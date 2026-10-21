import { z } from "zod";

export const PAPER_SIZES = {
  letter: { label: "Carta (8.5 × 11 in)", widthIn: 8.5, heightIn: 11, css: "8.5in 11in" },
  a4: { label: "A4 (210 × 297 mm)", widthIn: 210 / 25.4, heightIn: 297 / 25.4, css: "210mm 297mm" },
} as const;
export type PaperSize = keyof typeof PAPER_SIZES;

export const PHOTO_FIT_LABELS = {
  saint: "Según cada santo",
  contain: "Mostrar completas (sin recortar)",
  cover: "Recortar para llenar",
} as const;
export type PhotoFit = keyof typeof PHOTO_FIT_LABELS;

export const PER_PAGE_OPTIONS = [1, 2, 4] as const;
export type PerPage = (typeof PER_PAGE_OPTIONS)[number];

export const LIMITS = {
  marginIn: { min: 0.25, max: 1, step: 0.05 },
  fontSizePt: { min: 7, max: 14, step: 0.5 },
  bulletSpacingPt: { min: 0, max: 10, step: 0.5 },
  imageWidthPct: { min: 18, max: 40, step: 1 },
} as const;

export const worksheetSettingsSchema = z.object({
  paperSize: z.enum(["letter", "a4"]).default("letter"),
  perPage: z.union([z.literal(1), z.literal(2), z.literal(4)]).default(2),
  marginIn: z.number().min(LIMITS.marginIn.min).max(LIMITS.marginIn.max).default(0.5),
  fontSizePt: z.number().min(LIMITS.fontSizePt.min).max(LIMITS.fontSizePt.max).default(10.5),
  bulletSpacingPt: z.number().min(LIMITS.bulletSpacingPt.min).max(LIMITS.bulletSpacingPt.max).default(3),
  imageWidthPct: z.number().min(LIMITS.imageWidthPct.min).max(LIMITS.imageWidthPct.max).default(28),
  showPortrait: z.boolean().default(true),
  /** "saint" = each saint's own crop; "contain" = whole photo everywhere; "cover" = fill the box everywhere. */
  photoFit: z.enum(["saint", "contain", "cover"]).default("saint"),
  showCountry: z.boolean().default(true),
  showPageNumbers: z.boolean().default(true),
});
export type WorksheetSettings = z.infer<typeof worksheetSettingsSchema>;

export const DEFAULT_SETTINGS: WorksheetSettings = worksheetSettingsSchema.parse({});

/** What gets printed: ordered saints, which ones get a page to themselves, and layout settings. */
export const worksheetConfigSchema = z.object({
  saintIds: z.array(z.string()).max(500).default([]),
  soloSaintIds: z.array(z.string()).max(500).default([]),
  settings: worksheetSettingsSchema.default(DEFAULT_SETTINGS),
});
export type WorksheetConfig = z.infer<typeof worksheetConfigSchema>;

/** Parses stored/untrusted config, falling back to defaults field by field. */
export function coerceConfig(value: unknown): WorksheetConfig {
  const parsed = worksheetConfigSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  const v = (value ?? {}) as Partial<WorksheetConfig>;
  const settings = worksheetSettingsSchema.safeParse(v.settings);
  return {
    saintIds: Array.isArray(v.saintIds) ? v.saintIds.filter((s) => typeof s === "string") : [],
    soloSaintIds: Array.isArray(v.soloSaintIds) ? v.soloSaintIds.filter((s) => typeof s === "string") : [],
    settings: settings.success ? settings.data : DEFAULT_SETTINGS,
  };
}

/** base64url(JSON) so the print view and the PDF renderer receive the exact same config. */
export function encodeConfig(config: WorksheetConfig): string {
  const json = JSON.stringify(config);
  const b64 = typeof window === "undefined" ? Buffer.from(json, "utf8").toString("base64") : btoa(String.fromCharCode(...new TextEncoder().encode(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeConfig(encoded: string): WorksheetConfig | null {
  try {
    const b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof window === "undefined"
        ? Buffer.from(b64, "base64").toString("utf8")
        : new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)));
    const parsed = worksheetConfigSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
