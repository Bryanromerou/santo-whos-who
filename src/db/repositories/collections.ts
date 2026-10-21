import { asc, eq, inArray, sql } from "drizzle-orm";
import { AppError, notFound } from "@/lib/errors";
import { slugify, uniqueId } from "@/lib/text";
import { getDb, type Db, type Tx } from "../client";
import { collectionSaints, collections, saints } from "../schema";
import { nowIso } from "./saints";

type Conn = Db | Tx;

export type CollectionRecord = {
  id: string;
  name: string;
  position: number;
  saintIds: string[];
  createdAt: string;
  updatedAt: string;
};

export function listCollections(conn: Conn = getDb()): CollectionRecord[] {
  const rows = conn.select().from(collections).orderBy(asc(collections.position), asc(collections.name)).all();
  const members = conn.select().from(collectionSaints).orderBy(asc(collectionSaints.position)).all();
  const byCollection = new Map<string, string[]>();
  for (const m of members) byCollection.set(m.collectionId, [...(byCollection.get(m.collectionId) ?? []), m.saintId]);
  return rows.map((r) => ({ ...r, saintIds: byCollection.get(r.id) ?? [] }));
}

export function getCollection(id: string, conn: Conn = getDb()): CollectionRecord | null {
  const row = conn.select().from(collections).where(eq(collections.id, id)).get();
  if (!row) return null;
  const members = conn
    .select({ saintId: collectionSaints.saintId })
    .from(collectionSaints)
    .where(eq(collectionSaints.collectionId, id))
    .orderBy(asc(collectionSaints.position))
    .all();
  return { ...row, saintIds: members.map((m) => m.saintId) };
}

export function collectionExists(id: string, conn: Conn = getDb()): boolean {
  return !!conn.select({ id: collections.id }).from(collections).where(eq(collections.id, id)).get();
}

function nextPosition(conn: Conn): number {
  const max = conn.select({ m: sql<number | null>`max(${collections.position})` }).from(collections).get()?.m;
  return (max ?? -1) + 1;
}

/** Replaces the ordered membership list. Throws if any saint id is unknown or repeated. */
export function writeMembers(tx: Conn, collectionId: string, saintIds: string[]) {
  if (new Set(saintIds).size !== saintIds.length) {
    throw new AppError("La colección contiene santos repetidos.", 400);
  }
  if (saintIds.length) {
    const found = new Set(
      tx.select({ id: saints.id }).from(saints).where(inArray(saints.id, saintIds)).all().map((r) => r.id),
    );
    const missing = saintIds.filter((id) => !found.has(id));
    if (missing.length) throw new AppError(`Santos inexistentes en la colección: ${missing.join(", ")}`, 400);
  }
  tx.delete(collectionSaints).where(eq(collectionSaints.collectionId, collectionId)).run();
  if (saintIds.length) {
    tx.insert(collectionSaints).values(saintIds.map((saintId, position) => ({ collectionId, saintId, position }))).run();
  }
}

export function insertCollection(tx: Conn, id: string, name: string, saintIds: string[], position?: number) {
  const ts = nowIso();
  tx.insert(collections).values({ id, name, position: position ?? nextPosition(tx), createdAt: ts, updatedAt: ts }).run();
  writeMembers(tx, id, saintIds);
}

export function createCollection(name: string, saintIds: string[] = [], db: Db = getDb()): CollectionRecord {
  const clean = name.trim();
  if (!clean) throw new AppError("El nombre de la colección es obligatorio.");
  return db.transaction((tx) => {
    const id = uniqueId(slugify(clean), (c) => collectionExists(c, tx));
    insertCollection(tx, id, clean, saintIds);
    return getCollection(id, tx)!;
  });
}

export function updateCollection(
  id: string,
  patch: { name?: string; saintIds?: string[] },
  db: Db = getDb(),
): CollectionRecord {
  return db.transaction((tx) => {
    if (!collectionExists(id, tx)) throw notFound("La colección");
    const set: { updatedAt: string; name?: string } = { updatedAt: nowIso() };
    if (patch.name !== undefined) {
      const clean = patch.name.trim();
      if (!clean) throw new AppError("El nombre de la colección es obligatorio.");
      set.name = clean;
    }
    tx.update(collections).set(set).where(eq(collections.id, id)).run();
    if (patch.saintIds) writeMembers(tx, id, patch.saintIds);
    return getCollection(id, tx)!;
  });
}

/** Appends saints to a collection, ignoring ones already in it. */
export function addToCollection(id: string, saintIds: string[], db: Db = getDb()): CollectionRecord {
  return db.transaction((tx) => {
    const current = getCollection(id, tx);
    if (!current) throw notFound("La colección");
    const merged = [...current.saintIds, ...saintIds.filter((s) => !current.saintIds.includes(s))];
    writeMembers(tx, id, [...new Set(merged)]);
    tx.update(collections).set({ updatedAt: nowIso() }).where(eq(collections.id, id)).run();
    return getCollection(id, tx)!;
  });
}

/** Deletes the collection only; saints are untouched. */
export function deleteCollection(id: string, db: Db = getDb()) {
  const res = db.delete(collections).where(eq(collections.id, id)).run();
  if (res.changes === 0) throw notFound("La colección");
}

export function reorderCollections(ids: string[], db: Db = getDb()) {
  db.transaction((tx) => {
    ids.forEach((id, position) => tx.update(collections).set({ position }).where(eq(collections.id, id)).run());
  });
}
