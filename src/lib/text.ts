/** Lowercase, strip accents/diacritics and collapse whitespace for accent-insensitive search. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Returns true when every search term appears somewhere in the haystack (accent-insensitive). */
export function matchesSearch(haystack: string, query: string): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;
  const h = normalizeForSearch(haystack);
  return q.split(" ").every((term) => h.includes(term));
}

/** URL-safe slug: "San José Sánchez del Río" → "san-jose-sanchez-del-rio". */
export function slugify(value: string): string {
  return (
    normalizeForSearch(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "santo"
  );
}

/** Picks `base`, or `base-2`, `base-3`… so the result isn't in `taken`. */
export function uniqueId(base: string, taken: (id: string) => boolean): string {
  if (!taken(base)) return base;
  for (let i = 2; ; i++) {
    const candidate = `${base}-${i}`;
    if (!taken(candidate)) return candidate;
  }
}

export function pluralize(n: number, singular: string, plural: string): string {
  return `${n.toLocaleString("es")} ${n === 1 ? singular : plural}`;
}
