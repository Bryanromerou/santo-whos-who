import type { z } from "zod";
import { getDb, type Db } from "@/db/client";
import { collectionSaints, collections, saints } from "@/db/schema";
import { getUiLocale } from "@/db/repositories/settings";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { messages } from "@/i18n/messages";
import { loose, translator, type LooseT } from "@/i18n/translator";
import { zodErrorMap } from "@/i18n/zod";
import { librarySchemas, type LibraryFile, type LibrarySource } from "@/lib/schema/library";
import { isValidPortraitPath, portraitFileExists } from "@/lib/images/storage";
import { normalizeForSearch } from "@/lib/text";

import type { ImportMode } from "./modes";
export { IMPORT_MODES, type ImportMode } from "./modes";

export type ImportReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: { saints: number; characteristics: number; collections: number; memberships: number };
  plan: {
    mode: ImportMode;
    saintsCreate: number;
    saintsUpdate: number;
    saintsSkip: number;
    saintsDelete: number;
    collectionsCreate: number;
    collectionsUpdate: number;
    collectionsSkip: number;
    collectionsDelete: number;
    /** "skip" mode: existing collections that receive new members (nobody is removed). */
    collectionsMerge: number;
    membershipsAdded: number;
  };
  existingSaints: { id: string; name: string }[];
  existingCollections: { id: string; name: string }[];
  saintsPreview: { id: string; name: string; characteristics: number; reviewStatus: string; exists: boolean }[];
  collectionsPreview: { id: string; name: string; saints: number; exists: boolean }[];
  source: LibrarySource | null;
};

type RawLike = { saints?: { name?: unknown; id?: unknown }[]; collections?: { name?: unknown }[] } | null;

const reportT = (locale: Locale) => loose(translator(locale, "import.report"));

function describePath(path: PropertyKey[], raw: RawLike, t: LooseT): string {
  const parts: string[] = [];
  const named = (key: string, index: number, name: unknown) =>
    typeof name === "string" && name ? t(`${key}Named`, { n: index + 1, name }) : t(key, { n: index + 1 });
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    const next = path[i + 1];
    if (key === "saints" && typeof next === "number") {
      parts.push(named("saintAt", next, raw?.saints?.[next]?.name));
      i++;
    } else if (key === "collections" && typeof next === "number") {
      parts.push(named("collectionAt", next, raw?.collections?.[next]?.name));
      i++;
    } else if (key === "characteristics" && typeof next === "number") {
      parts.push(t("characteristicAt", { n: next + 1 }));
      i++;
    } else if (typeof key === "number") {
      parts.push(t("itemAt", { n: key + 1 }));
    } else {
      const field = String(key);
      parts.push(FIELD_KEYS.has(field) ? t(`fields.${field}`) : field);
    }
  }
  return parts.join(" › ");
}

const FIELD_KEYS = new Set(Object.keys(messages.es.import.report.fields));

export function formatZodIssues(error: z.ZodError, raw: unknown, limit = 60, locale: Locale = DEFAULT_LOCALE): string[] {
  const t = reportT(locale);
  const msgs = error.issues.map((issue) => {
    const where = describePath(issue.path, raw as RawLike, t);
    return where ? `${where}: ${issue.message}` : issue.message;
  });
  if (msgs.length > limit) return [...msgs.slice(0, limit), t("moreErrors", { count: msgs.length - limit })];
  return msgs;
}

/** Parses JSON text with a message in the interface language. */
export function parseJsonText(text: string, locale: Locale = DEFAULT_LOCALE): { value?: unknown; error?: string } {
  try {
    return { value: JSON.parse(text.replace(/^\uFEFF/, "")) };
  } catch (e) {
    return { error: reportT(locale)("invalidJsonFile", { message: (e as Error).message }) };
  }
}

export function parseLibrary(raw: unknown, locale: Locale = DEFAULT_LOCALE): { data?: LibraryFile; errors: string[] } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { errors: [reportT(locale)("notAnObject")] };
  }
  const result = librarySchemas(locale).file.safeParse(raw, { error: zodErrorMap(locale) });
  if (!result.success) return { errors: formatZodIssues(result.error, raw, 60, locale) };
  return { data: result.data, errors: [] };
}

export type AnalyzeOptions = {
  /** Portrait paths that will be available after import (backup restore). */
  availablePortraits?: Set<string>;
  /** Language for errors and warnings; defaults to the interface language stored in `db`. */
  locale?: Locale;
};

/** Cross-reference checks and dry-run plan against the current database. Never mutates. */
export function analyzeLibrary(data: LibraryFile, mode: ImportMode, opts: AnalyzeOptions = {}, db: Db = getDb()): ImportReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const t = reportT(opts.locale ?? getUiLocale(db));
  const q = (value: string) => t("quote", { value });

  // Saint ids unique within the file.
  const saintIdCount = new Map<string, number>();
  for (const s of data.saints) saintIdCount.set(s.id, (saintIdCount.get(s.id) ?? 0) + 1);
  for (const [id, n] of saintIdCount) if (n > 1) errors.push(t("duplicateSaintId", { id, count: n }));

  // Characteristic ids unique per saint; nonempty lists recommended.
  const globalCharIds = new Map<string, string[]>();
  for (const s of data.saints) {
    const seen = new Set<string>();
    for (const c of s.characteristics) {
      if (seen.has(c.id)) errors.push(t("duplicateCharacteristicId", { saint: s.name, id: c.id }));
      seen.add(c.id);
      globalCharIds.set(c.id, [...(globalCharIds.get(c.id) ?? []), s.name]);
    }
    if (s.characteristics.length === 0) warnings.push(t("noCharacteristics", { saint: s.name }));
    if (s.portraitPath !== null) {
      const ok = isValidPortraitPath(s.portraitPath) && (opts.availablePortraits?.has(s.portraitPath) || portraitFileExists(s.portraitPath));
      if (!ok) warnings.push(t("portraitUnavailable", { saint: s.name, path: s.portraitPath }));
    }
  }
  const sharedCharIds = [...globalCharIds.entries()].filter(([, owners]) => owners.length > 1);
  if (sharedCharIds.length) {
    warnings.push(t("sharedCharacteristicIds", { count: sharedCharIds.length, example: sharedCharIds[0][0] }));
  }

  // Possible duplicates by normalized name.
  const byName = new Map<string, string[]>();
  for (const s of data.saints) {
    const k = normalizeForSearch(s.name);
    byName.set(k, [...(byName.get(k) ?? []), s.id]);
  }
  for (const ids of byName.values()) {
    if (ids.length > 1) warnings.push(t("possibleDuplicate", { ids: ids.map(q).join(", ") }));
  }

  // Existing records in the database.
  const dbSaints = db.select({ id: saints.id, name: saints.name }).from(saints).all();
  const dbSaintIds = new Set(dbSaints.map((s) => s.id));
  const dbCollections = db.select({ id: collections.id, name: collections.name }).from(collections).all();
  const dbCollectionIds = new Set(dbCollections.map((c) => c.id));
  const fileSaintIds = new Set(data.saints.map((s) => s.id));

  // Collection checks.
  const collectionIdCount = new Map<string, number>();
  for (const c of data.collections) collectionIdCount.set(c.id, (collectionIdCount.get(c.id) ?? 0) + 1);
  for (const [id, n] of collectionIdCount) if (n > 1) errors.push(t("duplicateCollectionId", { id, count: n }));
  for (const c of data.collections) {
    const seen = new Set<string>();
    for (const sid of c.saintIds) {
      if (seen.has(sid)) errors.push(t("collectionRepeatedSaint", { collection: c.name, id: sid }));
      seen.add(sid);
      const known = fileSaintIds.has(sid) || (mode !== "replace" && dbSaintIds.has(sid));
      if (!known) errors.push(t("collectionUnknownSaint", { collection: c.name, id: sid }));
    }
  }

  const existingSaints = data.saints.filter((s) => dbSaintIds.has(s.id)).map((s) => ({ id: s.id, name: s.name }));
  const existingCollections = data.collections.filter((c) => dbCollectionIds.has(c.id)).map((c) => ({ id: c.id, name: c.name }));
  const nNew = data.saints.length - existingSaints.length;
  const nNewCollections = data.collections.length - existingCollections.length;

  // In skip mode, existing collections keep their members and gain the file's new ones.
  let collectionsMerge = 0;
  let membershipsAdded = 0;
  if (mode === "skip" && existingCollections.length) {
    const current = new Map<string, Set<string>>();
    for (const m of db.select().from(collectionSaints).all()) {
      if (!current.has(m.collectionId)) current.set(m.collectionId, new Set());
      current.get(m.collectionId)!.add(m.saintId);
    }
    for (const c of data.collections) {
      if (!dbCollectionIds.has(c.id)) continue;
      const added = c.saintIds.filter((id) => !current.get(c.id)?.has(id)).length;
      if (added) {
        collectionsMerge++;
        membershipsAdded += added;
      }
    }
  }

  const plan: ImportReport["plan"] = {
    mode,
    saintsCreate: mode === "replace" ? data.saints.length : nNew,
    saintsUpdate: mode === "update" ? existingSaints.length : 0,
    saintsSkip: mode === "skip" ? existingSaints.length : 0,
    saintsDelete: mode === "replace" ? dbSaints.length : 0,
    collectionsCreate: mode === "replace" ? data.collections.length : nNewCollections,
    collectionsUpdate: mode === "update" ? existingCollections.length : 0,
    collectionsSkip: mode === "skip" ? existingCollections.length - collectionsMerge : 0,
    collectionsDelete: mode === "replace" ? dbCollections.length : 0,
    collectionsMerge,
    membershipsAdded,
  };

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      saints: data.saints.length,
      characteristics: data.saints.reduce((n, s) => n + s.characteristics.length, 0),
      collections: data.collections.length,
      memberships: data.collections.reduce((n, c) => n + c.saintIds.length, 0),
    },
    plan,
    existingSaints,
    existingCollections,
    saintsPreview: data.saints.map((s) => ({
      id: s.id,
      name: s.name,
      characteristics: s.characteristics.length,
      reviewStatus: s.reviewStatus,
      exists: dbSaintIds.has(s.id),
    })),
    collectionsPreview: data.collections.map((c) => ({ id: c.id, name: c.name, saints: c.saintIds.length, exists: dbCollectionIds.has(c.id) })),
    source: data.source ?? null,
  };
}

/** Builds an empty failing report for parse errors (so the UI can show one shape). */
export function failedReport(errors: string[], mode: ImportMode): ImportReport {
  return {
    ok: false,
    errors,
    warnings: [],
    stats: { saints: 0, characteristics: 0, collections: 0, memberships: 0 },
    plan: { mode, saintsCreate: 0, saintsUpdate: 0, saintsSkip: 0, saintsDelete: 0, collectionsCreate: 0, collectionsUpdate: 0, collectionsSkip: 0, collectionsDelete: 0, collectionsMerge: 0, membershipsAdded: 0 },
    existingSaints: [],
    existingCollections: [],
    saintsPreview: [],
    collectionsPreview: [],
    source: null,
  };
}

export function validateLibrary(raw: unknown, mode: ImportMode, opts: AnalyzeOptions = {}, db: Db = getDb()) {
  const locale = opts.locale ?? getUiLocale(db);
  const parsed = parseLibrary(raw, locale);
  if (!parsed.data) return { report: failedReport(parsed.errors, mode), data: undefined };
  return { report: analyzeLibrary(parsed.data, mode, { ...opts, locale }, db), data: parsed.data };
}
