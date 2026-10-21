/**
 * Matches image file names to saint names for bulk portrait import.
 * Pure functions (no DOM, no server) so they run in the browser and in tests.
 *
 *   exact  — same name after ignoring accents, case, punctuation, extension
 *            and extra spaces  → mapped automatically
 *   fuzzy  — similarity ≥ FUZZY_THRESHOLD (80 %) → must be confirmed in the review modal
 *   none   — below the threshold → left unassigned (can be assigned by hand)
 */
export const FUZZY_THRESHOLD = 0.8;

export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "heic", "heif"];

const HONORIFICS = new Set(["san", "santa", "santo", "saint", "st", "sta", "sto", "beato", "beata", "padre", "madre"]);

export function fileBaseName(fileName: string): string {
  const name = fileName.split(/[\\/]/).pop() ?? fileName;
  return name.replace(/\.[^.]+$/, "").trim();
}

export function fileExtension(fileName: string): string {
  return (/\.([^.]+)$/.exec(fileName)?.[1] ?? "").toLowerCase();
}

export function isImageFileName(fileName: string): boolean {
  return IMAGE_EXTENSIONS.includes(fileExtension(fileName));
}

/** "Santa María  Goretti " → "santa maria goretti" */
export function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function stripHonorifics(normalized: string): string {
  const words = normalized.split(" ");
  while (words.length > 1 && HONORIFICS.has(words[0])) words.shift();
  return words.join(" ");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

function ratio(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

/** 0–1 similarity between a file's base name and a saint name. */
export function nameSimilarity(fileBase: string, saintName: string): number {
  const a = normalizeName(fileBase);
  const b = normalizeName(saintName);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const a2 = stripHonorifics(a);
  const b2 = stripHonorifics(b);
  if (a2 === b2) return 1; // "Juan Bosco" ↔ "San Juan Bosco"
  return Math.max(ratio(a, b), ratio(a2, b2));
}

export type MatchKind = "exact" | "fuzzy" | "none";

export type FileMatch = {
  fileName: string;
  kind: MatchKind;
  /** Best candidate (null when nothing is close). */
  saintId: string | null;
  score: number;
  /** Next-best candidates, for the review modal. */
  alternatives: { saintId: string; score: number }[];
};

export function matchFile(fileName: string, saints: { id: string; name: string }[]): FileMatch {
  const base = fileBaseName(fileName);
  const scored = saints
    .map((s) => ({ saintId: s.id, score: nameSimilarity(base, s.name) }))
    .sort((x, y) => y.score - x.score);
  const best = scored[0];
  if (!best || best.score < FUZZY_THRESHOLD) {
    return { fileName, kind: "none", saintId: null, score: best?.score ?? 0, alternatives: scored.slice(0, 3) };
  }
  // Two saints tie for an "exact" match (e.g. duplicated records) → needs review.
  const exact = best.score === 1 && scored[1]?.score !== 1;
  return {
    fileName,
    kind: exact ? "exact" : "fuzzy",
    saintId: best.saintId,
    score: best.score,
    alternatives: scored.slice(1, 4).filter((c) => c.score >= FUZZY_THRESHOLD - 0.15),
  };
}

/** Groups of file keys assigned to the same saint (only groups with 2+ files). */
export function duplicateGroups<T extends { key: string; saintId: string | null }>(items: T[]): Map<string, string[]> {
  const bySaint = new Map<string, string[]>();
  for (const it of items) {
    if (!it.saintId) continue;
    bySaint.set(it.saintId, [...(bySaint.get(it.saintId) ?? []), it.key]);
  }
  return new Map([...bySaint].filter(([, keys]) => keys.length > 1));
}
