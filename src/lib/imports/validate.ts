import type { z } from "zod";
import { getDb, type Db } from "@/db/client";
import { collections, saints } from "@/db/schema";
import { libraryFileSchema, type LibraryFile, type LibrarySource } from "@/lib/schema/library";
import { isValidPortraitPath, portraitFileExists } from "@/lib/images/storage";
import { normalizeForSearch } from "@/lib/text";

import type { ImportMode } from "./modes";
export { IMPORT_MODES, IMPORT_MODE_LABELS, type ImportMode } from "./modes";

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
  };
  existingSaints: { id: string; name: string }[];
  existingCollections: { id: string; name: string }[];
  saintsPreview: { id: string; name: string; characteristics: number; reviewStatus: string; exists: boolean }[];
  collectionsPreview: { id: string; name: string; saints: number; exists: boolean }[];
  source: LibrarySource | null;
};

const FIELD_LABELS: Record<string, string> = {
  schemaVersion: "versión del esquema (schemaVersion)",
  format: "formato (format)",
  language: "idioma (language)",
  source: "origen (source)",
  saints: "santos",
  collections: "colecciones",
  id: "id",
  name: "nombre",
  birthYear: "año de nacimiento (birthYear)",
  birthYearDisplay: "año de nacimiento mostrado (birthYearDisplay)",
  ageAtDeath: "edad al morir (ageAtDeath)",
  ageAtDeathDisplay: "edad mostrada (ageAtDeathDisplay)",
  country: "país (country)",
  portraitPath: "retrato (portraitPath)",
  isMartyr: "mártir (isMartyr)",
  categories: "categorías",
  patronages: "patronazgos",
  canonizationYear: "año de canonización (canonizationYear)",
  characteristics: "características",
  sources: "fuentes",
  reviewStatus: "estado de revisión (reviewStatus)",
  text: "texto",
  type: "tipo",
  saintIds: "santos de la colección (saintIds)",
};

type RawLike = { saints?: { name?: unknown; id?: unknown }[]; collections?: { name?: unknown }[] } | null;

function describePath(path: PropertyKey[], raw: RawLike): string {
  const parts: string[] = [];
  for (let i = 0; i < path.length; i++) {
    const key = path[i];
    const next = path[i + 1];
    if (key === "saints" && typeof next === "number") {
      const n = raw?.saints?.[next]?.name;
      parts.push(`Santo n.º ${next + 1}${typeof n === "string" && n ? ` («${n}»)` : ""}`);
      i++;
    } else if (key === "collections" && typeof next === "number") {
      const n = raw?.collections?.[next]?.name;
      parts.push(`Colección n.º ${next + 1}${typeof n === "string" && n ? ` («${n}»)` : ""}`);
      i++;
    } else if (key === "characteristics" && typeof next === "number") {
      parts.push(`característica n.º ${next + 1}`);
      i++;
    } else if (typeof key === "number") {
      parts.push(`elemento n.º ${key + 1}`);
    } else {
      parts.push(FIELD_LABELS[String(key)] ?? String(key));
    }
  }
  return parts.join(" › ");
}

export function formatZodIssues(error: z.ZodError, raw: unknown, limit = 60): string[] {
  const msgs = error.issues.map((issue) => {
    const where = describePath(issue.path, raw as RawLike);
    return where ? `${where}: ${issue.message}` : issue.message;
  });
  if (msgs.length > limit) return [...msgs.slice(0, limit), `…y ${msgs.length - limit} errores más.`];
  return msgs;
}

/** Parses JSON text with a Spanish error message. */
export function parseJsonText(text: string): { value?: unknown; error?: string } {
  try {
    return { value: JSON.parse(text.replace(/^﻿/, "")) };
  } catch (e) {
    return { error: `El archivo no es JSON válido: ${(e as Error).message}` };
  }
}

export function parseLibrary(raw: unknown): { data?: LibraryFile; errors: string[] } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { errors: ["El archivo debe contener un objeto JSON con schemaVersion, format, language, source, saints y collections."] };
  }
  const result = libraryFileSchema.safeParse(raw);
  if (!result.success) return { errors: formatZodIssues(result.error, raw) };
  return { data: result.data, errors: [] };
}

export type AnalyzeOptions = {
  /** Portrait paths that will be available after import (backup restore). */
  availablePortraits?: Set<string>;
};

/** Cross-reference checks and dry-run plan against the current database. Never mutates. */
export function analyzeLibrary(data: LibraryFile, mode: ImportMode, opts: AnalyzeOptions = {}, db: Db = getDb()): ImportReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Saint ids unique within the file.
  const saintIdCount = new Map<string, number>();
  for (const s of data.saints) saintIdCount.set(s.id, (saintIdCount.get(s.id) ?? 0) + 1);
  for (const [id, n] of saintIdCount) if (n > 1) errors.push(`El id de santo «${id}» aparece ${n} veces en el archivo.`);

  // Characteristic ids unique per saint; nonempty lists recommended.
  const globalCharIds = new Map<string, string[]>();
  for (const s of data.saints) {
    const seen = new Set<string>();
    for (const c of s.characteristics) {
      if (seen.has(c.id)) errors.push(`«${s.name}»: el id de característica «${c.id}» está repetido.`);
      seen.add(c.id);
      globalCharIds.set(c.id, [...(globalCharIds.get(c.id) ?? []), s.name]);
    }
    if (s.characteristics.length === 0) warnings.push(`«${s.name}» no tiene características.`);
    if (s.portraitPath !== null) {
      const ok = isValidPortraitPath(s.portraitPath) && (opts.availablePortraits?.has(s.portraitPath) || portraitFileExists(s.portraitPath));
      if (!ok) warnings.push(`«${s.name}»: el retrato «${s.portraitPath}» no está disponible en este equipo; se importará sin foto.`);
    }
  }
  const sharedCharIds = [...globalCharIds.entries()].filter(([, owners]) => owners.length > 1);
  if (sharedCharIds.length) {
    warnings.push(
      `${sharedCharIds.length} id(s) de característica se repiten entre santos distintos (p. ej. «${sharedCharIds[0][0]}»). Se permite porque cada id se guarda por santo.`,
    );
  }

  // Possible duplicates by normalized name.
  const byName = new Map<string, string[]>();
  for (const s of data.saints) {
    const k = normalizeForSearch(s.name);
    byName.set(k, [...(byName.get(k) ?? []), s.id]);
  }
  for (const ids of byName.values()) {
    if (ids.length > 1) warnings.push(`Posible duplicado: los ids ${ids.map((i) => `«${i}»`).join(", ")} tienen el mismo nombre.`);
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
  for (const [id, n] of collectionIdCount) if (n > 1) errors.push(`El id de colección «${id}» aparece ${n} veces.`);
  for (const c of data.collections) {
    const seen = new Set<string>();
    for (const sid of c.saintIds) {
      if (seen.has(sid)) errors.push(`Colección «${c.name}»: el santo «${sid}» aparece más de una vez.`);
      seen.add(sid);
      const known = fileSaintIds.has(sid) || (mode !== "replace" && dbSaintIds.has(sid));
      if (!known) errors.push(`Colección «${c.name}»: el santo «${sid}» no existe en el archivo.`);
    }
  }

  const existingSaints = data.saints.filter((s) => dbSaintIds.has(s.id)).map((s) => ({ id: s.id, name: s.name }));
  const existingCollections = data.collections.filter((c) => dbCollectionIds.has(c.id)).map((c) => ({ id: c.id, name: c.name }));
  const nNew = data.saints.length - existingSaints.length;
  const nNewCollections = data.collections.length - existingCollections.length;

  const plan: ImportReport["plan"] = {
    mode,
    saintsCreate: mode === "replace" ? data.saints.length : nNew,
    saintsUpdate: mode === "update" ? existingSaints.length : 0,
    saintsSkip: mode === "skip" ? existingSaints.length : 0,
    saintsDelete: mode === "replace" ? dbSaints.length : 0,
    collectionsCreate: mode === "replace" ? data.collections.length : nNewCollections,
    collectionsUpdate: mode === "update" ? existingCollections.length : 0,
    collectionsSkip: mode === "skip" ? existingCollections.length : 0,
    collectionsDelete: mode === "replace" ? dbCollections.length : 0,
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
    plan: { mode, saintsCreate: 0, saintsUpdate: 0, saintsSkip: 0, saintsDelete: 0, collectionsCreate: 0, collectionsUpdate: 0, collectionsSkip: 0, collectionsDelete: 0 },
    existingSaints: [],
    existingCollections: [],
    saintsPreview: [],
    collectionsPreview: [],
    source: null,
  };
}

export function validateLibrary(raw: unknown, mode: ImportMode, opts: AnalyzeOptions = {}, db: Db = getDb()) {
  const parsed = parseLibrary(raw);
  if (!parsed.data) return { report: failedReport(parsed.errors, mode), data: undefined };
  return { report: analyzeLibrary(parsed.data, mode, opts, db), data: parsed.data };
}
