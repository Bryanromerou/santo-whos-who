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
