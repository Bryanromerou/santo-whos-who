import { asc, eq, inArray, sql } from "drizzle-orm";
import { AppError, notFound } from "@/lib/errors";
import type { SaintInput } from "@/lib/schema/saint";
import { slugify, uniqueId } from "@/lib/text";
import { getDb, type Db, type Tx } from "../client";
import {
  characteristics,
  collectionSaints,
  patronages,
  saintCategories,
  saints,
  sources,
  type CharacteristicType,
  type PortraitFit,
  type ReviewStatus,
} from "../schema";

export type SaintCharacteristic = { id: string; text: string; type: CharacteristicType };
export type PortraitSettings = { focalX: number; focalY: number; zoom: number; fit: PortraitFit };

/** A saint with all child rows, in display order. */
export type SaintRecord = {
  id: string;
  name: string;
  birthYear: number | null;
  birthYearDisplay: string;
  ageAtDeath: number | null;
  ageAtDeathDisplay: string;
  country: string;
  canonizationYear: number | null;
  isMartyr: boolean;
  reviewStatus: ReviewStatus;
  portraitPath: string | null;
  portrait: PortraitSettings;
  categories: string[];
  patronages: string[];
  sources: string[];
  characteristics: SaintCharacteristic[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

/** Fields shared by editor saves and imports. */
export type SaintData = Omit<SaintRecord, "id" | "sortOrder" | "createdAt" | "updatedAt">;

type Conn = Db | Tx;
export const nowIso = () => new Date().toISOString();

function groupBy<T extends { saintId: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const list = m.get(r.saintId);
    if (list) list.push(r);
    else m.set(r.saintId, [r]);
  }
  return m;
}

function loadSaints(conn: Conn, ids?: string[]): SaintRecord[] {
  if (ids && ids.length === 0) return [];
  const where = ids ? inArray(saints.id, ids) : undefined;
  const rows = conn.select().from(saints).where(where).orderBy(asc(saints.sortOrder), asc(saints.name)).all();
  if (rows.length === 0) return [];
  const rowIds = rows.map((r) => r.id);
  const chars = groupBy(
    conn.select().from(characteristics).where(inArray(characteristics.saintId, rowIds)).orderBy(asc(characteristics.position)).all(),
  );
  const cats = groupBy(
    conn.select().from(saintCategories).where(inArray(saintCategories.saintId, rowIds)).orderBy(asc(saintCategories.position)).all(),
  );
  const pats = groupBy(
    conn.select().from(patronages).where(inArray(patronages.saintId, rowIds)).orderBy(asc(patronages.position)).all(),
  );
  const srcs = groupBy(
    conn.select().from(sources).where(inArray(sources.saintId, rowIds)).orderBy(asc(sources.position)).all(),
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    birthYear: r.birthYear,
    birthYearDisplay: r.birthYearDisplay,
    ageAtDeath: r.ageAtDeath,
    ageAtDeathDisplay: r.ageAtDeathDisplay,
    country: r.country,
    canonizationYear: r.canonizationYear,
    isMartyr: r.isMartyr,
    reviewStatus: r.reviewStatus,
    portraitPath: r.portraitPath,
    portrait: { focalX: r.portraitFocalX, focalY: r.portraitFocalY, zoom: r.portraitZoom, fit: r.portraitFit },
    categories: (cats.get(r.id) ?? []).map((c) => c.category),
    patronages: (pats.get(r.id) ?? []).map((p) => p.text),
    sources: (srcs.get(r.id) ?? []).map((s) => s.text),
    characteristics: (chars.get(r.id) ?? []).map((c) => ({ id: c.id, text: c.text, type: c.type })),
    sortOrder: r.sortOrder,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export function listSaints(conn: Conn = getDb()): SaintRecord[] {
  return loadSaints(conn);
}

/** Returns saints for the given ids, in the order of `ids` (unknown ids are skipped). */
export function getSaintsByIds(ids: string[], conn: Conn = getDb()): SaintRecord[] {
  const byId = new Map(loadSaints(conn, [...new Set(ids)]).map((s) => [s.id, s]));
  return ids.map((id) => byId.get(id)).filter((s): s is SaintRecord => !!s);
}

export function getSaint(id: string, conn: Conn = getDb()): SaintRecord | null {
  return loadSaints(conn, [id])[0] ?? null;
}

export function saintExists(id: string, conn: Conn = getDb()): boolean {
  return !!conn.select({ id: saints.id }).from(saints).where(eq(saints.id, id)).get();
}

export function countSaints(conn: Conn = getDb()): number {
  return conn.select({ n: sql<number>`count(*)` }).from(saints).get()?.n ?? 0;
}

export function nextSortOrder(conn: Conn): number {
  const max = conn.select({ m: sql<number | null>`max(${saints.sortOrder})` }).from(saints).get()?.m;
  return (max ?? -1) + 1;
}

/** Replaces all child rows (characteristics, categories, patronages, sources) of a saint. */
export function writeSaintChildren(tx: Conn, saintId: string, data: Pick<SaintData, "characteristics" | "categories" | "patronages" | "sources">) {
  tx.delete(characteristics).where(eq(characteristics.saintId, saintId)).run();
  tx.delete(saintCategories).where(eq(saintCategories.saintId, saintId)).run();
  tx.delete(patronages).where(eq(patronages.saintId, saintId)).run();
  tx.delete(sources).where(eq(sources.saintId, saintId)).run();

  if (data.characteristics.length) {
    tx.insert(characteristics)
      .values(data.characteristics.map((c, i) => ({ saintId, id: c.id, text: c.text, type: c.type, position: i })))
      .run();
  }
  const cats = [...new Set(data.categories)];
  if (cats.length) {
    tx.insert(saintCategories).values(cats.map((category, i) => ({ saintId, category, position: i }))).run();
  }
  if (data.patronages.length) {
    tx.insert(patronages).values(data.patronages.map((text, i) => ({ saintId, text, position: i }))).run();
  }
  if (data.sources.length) {
    tx.insert(sources).values(data.sources.map((text, i) => ({ saintId, text, position: i }))).run();
  }
}

export function scalarColumns(data: SaintData) {
  return {
    name: data.name,
    birthYear: data.birthYear,
    birthYearDisplay: data.birthYearDisplay,
    ageAtDeath: data.ageAtDeath,
    ageAtDeathDisplay: data.ageAtDeathDisplay,
    country: data.country,
    canonizationYear: data.canonizationYear,
    isMartyr: data.isMartyr,
    reviewStatus: data.reviewStatus,
    portraitPath: data.portraitPath,
    portraitFocalX: data.portrait.focalX,
    portraitFocalY: data.portrait.focalY,
    portraitZoom: data.portrait.zoom,
    portraitFit: data.portrait.fit,
  };
}

/** Inserts a full saint (scalars + children). Caller supplies the transaction. */
export function insertSaint(tx: Conn, id: string, data: SaintData, sortOrder: number) {
  const ts = nowIso();
  tx.insert(saints).values({ id, ...scalarColumns(data), sortOrder, createdAt: ts, updatedAt: ts }).run();
  writeSaintChildren(tx, id, data);
}

function inputToData(input: SaintInput, portraitPath: string | null): SaintData {
  return {
    name: input.name,
    birthYear: input.birthYear,
    birthYearDisplay: input.birthYearDisplay,
    ageAtDeath: input.ageAtDeath,
    ageAtDeathDisplay: input.ageAtDeathDisplay,
    country: input.country,
    canonizationYear: input.canonizationYear,
    isMartyr: input.isMartyr,
    reviewStatus: input.reviewStatus,
    portraitPath,
    portrait: input.portrait,
    categories: input.categories,
    patronages: input.patronages,
    sources: input.sources,
    characteristics: input.characteristics,
  };
}

export function createSaint(input: SaintInput, db: Db = getDb()): SaintRecord {
  return db.transaction((tx) => {
    const id = uniqueId(slugify(input.name), (c) => saintExists(c, tx));
    insertSaint(tx, id, inputToData(input, null), nextSortOrder(tx));
    return getSaint(id, tx)!;
  });
}

/**
 * Saves editor changes. The portrait file itself is managed by the portrait
 * endpoints, so `portraitPath` is left untouched here (only crop settings change).
 */
export function updateSaint(id: string, input: SaintInput, db: Db = getDb()): SaintRecord {
  return db.transaction((tx) => {
    const current = tx.select().from(saints).where(eq(saints.id, id)).get();
    if (!current) throw notFound("saint");
    if (input.expectedUpdatedAt && input.expectedUpdatedAt !== current.updatedAt) {
      throw new AppError("editConflict", { status: 409 });
    }
    const data = inputToData(input, current.portraitPath);
    tx.update(saints).set({ ...scalarColumns(data), updatedAt: nowIso() }).where(eq(saints.id, id)).run();
    writeSaintChildren(tx, id, data);
    return getSaint(id, tx)!;
  });
}

/** Deletes a saint (children and collection memberships cascade). Returns its former portrait path. */
export function deleteSaint(id: string, db: Db = getDb()): { portraitPath: string | null } {
  return db.transaction((tx) => {
    const current = tx.select({ portraitPath: saints.portraitPath }).from(saints).where(eq(saints.id, id)).get();
    if (!current) throw notFound("saint");
    tx.delete(saints).where(eq(saints.id, id)).run();
    return { portraitPath: current.portraitPath };
  });
}

/** Copies a saint. The copy shares the portrait file (reference-counted on delete). */
export function duplicateSaint(id: string, db: Db = getDb()): SaintRecord {
  return db.transaction((tx) => {
    const original = getSaint(id, tx);
    if (!original) throw notFound("saint");
    const newId = uniqueId(`${original.id}-copia`, (c) => saintExists(c, tx));
    const data: SaintData = {
      ...original,
      name: `${original.name} (copia)`,
      // Characteristic ids are scoped per saint, so the copy can keep them.
      characteristics: original.characteristics.map((c) => ({ ...c })),
    };
    insertSaint(tx, newId, data, nextSortOrder(tx));
    return getSaint(newId, tx)!;
  });
}

/** Number of saints referencing a portrait file. */
export function portraitReferenceCount(path: string, conn: Conn = getDb()): number {
  return conn.select({ n: sql<number>`count(*)` }).from(saints).where(eq(saints.portraitPath, path)).get()?.n ?? 0;
}

/** Ids of collections containing each saint. */
export function collectionIdsBySaint(conn: Conn = getDb()): Map<string, string[]> {
  const rows = conn.select().from(collectionSaints).all();
  const m = new Map<string, string[]>();
  for (const r of rows) m.set(r.saintId, [...(m.get(r.saintId) ?? []), r.collectionId]);
  return m;
}

/**
 * Sets the review status of many saints in one transaction.
 * Returns how many saints were found and updated; unknown ids are ignored.
 */
export function setReviewStatus(ids: string[], status: ReviewStatus, db: Db = getDb()): number {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return 0;
  return db.transaction((tx) => {
    const res = tx.update(saints).set({ reviewStatus: status, updatedAt: nowIso() }).where(inArray(saints.id, unique)).run();
    return res.changes;
  });
}
