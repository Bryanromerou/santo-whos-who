import { normalizeForSearch } from "./text";

/** Spanish labels for the category slugs used in santos_studio_43_santos.json. */
const KNOWN: Record<string, string> = {
  "lista-original": "Lista original",
  "santos-adicionales": "Santos adicionales",
  "santos-jovenes": "Santos jóvenes",
  martires: "Santos mártires",
  "santos-martires": "Santos mártires",
  "educadores-y-guias": "Educadores y guías",
  "patronos-de-la-juventud": "Patronos de la juventud",
};

/** Featured filters shown first in the library, in this order. */
export const FEATURED_CATEGORIES = ["santos-jovenes", "martires", "educadores-y-guias", "patronos-de-la-juventud"];

export function categoryLabel(slug: string): string {
  if (KNOWN[slug]) return KNOWN[slug];
  const pretty = slug.replace(/[-_]+/g, " ").trim();
  return pretty ? pretty.charAt(0).toUpperCase() + pretty.slice(1) : slug;
}

/** Matches a category against a filter slug (accent/format-insensitive). */
export function sameCategory(a: string, b: string): boolean {
  const n = (s: string) => normalizeForSearch(KNOWN[s] ?? s).replace(/[^a-z0-9]/g, "");
  return a === b || n(a) === n(b);
}
