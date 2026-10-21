import type { PortraitSettings, SaintRecord } from "@/db/repositories/saints";

/** Serializable data needed to render one saint card (shared by preview, print and PDF). */
export type WorksheetSaint = {
  id: string;
  name: string;
  birth: string;
  age: string;
  country: string;
  characteristics: { id: string; text: string }[];
  portrait: (PortraitSettings & { src: string }) | null;
};

/**
 * Display rules: show the imported display text exactly; fall back to the
 * number only when no display text exists; never invent missing values.
 */
export function birthDisplay(s: Pick<SaintRecord, "birthYear" | "birthYearDisplay">): string {
  if (s.birthYearDisplay.trim()) return s.birthYearDisplay;
  return s.birthYear !== null ? String(s.birthYear) : "—";
}

export function ageDisplay(s: Pick<SaintRecord, "ageAtDeath" | "ageAtDeathDisplay">): string {
  if (s.ageAtDeathDisplay.trim()) return s.ageAtDeathDisplay;
  return s.ageAtDeath !== null ? `${s.ageAtDeath} años` : "—";
}

export function toWorksheetSaint(
  s: Pick<SaintRecord, "id" | "name" | "birthYear" | "birthYearDisplay" | "ageAtDeath" | "ageAtDeathDisplay" | "country" | "characteristics" | "portrait">,
  portraitSrc: string | null,
): WorksheetSaint {
  return {
    id: s.id,
    name: s.name,
    birth: birthDisplay(s),
    age: ageDisplay(s),
    country: s.country.trim() || "—",
    characteristics: s.characteristics.map((c) => ({ id: c.id, text: c.text })),
    portrait: portraitSrc ? { ...s.portrait, src: portraitSrc } : null,
  };
}

/**
 * Applies the worksheet-wide photo setting on top of the saint's own crop.
 *  - "saint":   keep the saint's fit, zoom and focal point
 *  - "contain": show the whole photo (zoom/position reset so nothing is cut)
 *  - "cover":   fill the box, keeping the saint's zoom/position as the crop
 */
export function effectivePortrait(
  portrait: WorksheetSaint["portrait"],
  photoFit: "saint" | "contain" | "cover",
): WorksheetSaint["portrait"] {
  if (!portrait || photoFit === "saint") return portrait;
  if (photoFit === "contain") return { ...portrait, fit: "contain", zoom: 1, focalX: 50, focalY: 50 };
  return { ...portrait, fit: "cover" };
}
