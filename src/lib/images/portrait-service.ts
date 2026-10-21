import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { eq, isNotNull } from "drizzle-orm";
import { getDb, type Db } from "@/db/client";
import { getSaint, nowIso, portraitReferenceCount, type SaintRecord } from "@/db/repositories/saints";
import { portraits, saints } from "@/db/schema";
import { maxUploadBytes } from "@/lib/config";
import { notFound } from "@/lib/errors";
import { processPortrait } from "./process";
import {
  deletePortraitFiles,
  listPortraitFilesOnDisk,
  masterFilename,
  portraitPathFor,
  resolveServeFile,
  thumbFilename,
  writeFileAtomic,
} from "./storage";

/** Writes processed master + thumbnail to disk under a new opaque UUID name. */
export async function storePortraitFiles(input: Buffer) {
  const processed = await processPortrait(input, maxUploadBytes());
  const portraitPath = portraitPathFor(randomUUID());
  writeFileAtomic(resolveServeFile(masterFilename(portraitPath))!, processed.master);
  writeFileAtomic(resolveServeFile(thumbFilename(portraitPath))!, processed.thumb);
  return { portraitPath, ...processed };
}

/** Deletes a portrait's files and metadata row if no saint references it anymore. */
export function releasePortraitIfUnused(portraitPath: string | null, db: Db = getDb()) {
  if (!portraitPath) return;
  if (portraitReferenceCount(portraitPath, db) > 0) return;
  db.delete(portraits).where(eq(portraits.path, portraitPath)).run();
  deletePortraitFiles(portraitPath);
}

/**
 * Uploads a new portrait for a saint. Order of operations guarantees no
 * dangling references: (1) new files written, (2) DB updated in a transaction,
 * (3) only then the previous file is removed if nothing else uses it.
 */
export async function setSaintPortrait(saintId: string, input: Buffer, db: Db = getDb()): Promise<SaintRecord> {
  if (!getSaint(saintId, db)) throw notFound("saint");
  const stored = await storePortraitFiles(input);
  let previous: string | null = null;
  try {
    db.transaction((tx) => {
      const row = tx.select({ portraitPath: saints.portraitPath }).from(saints).where(eq(saints.id, saintId)).get();
      if (!row) throw notFound("saint");
      previous = row.portraitPath;
      tx.insert(portraits)
        .values({
          path: stored.portraitPath,
          thumbPath: `uploads/saints/${thumbFilename(stored.portraitPath)}`,
          width: stored.width,
          height: stored.height,
          bytes: stored.master.length,
          sourceFormat: stored.sourceFormat,
        })
        .run();
      tx.update(saints)
        .set({
          portraitPath: stored.portraitPath,
          portraitFocalX: 50,
          portraitFocalY: 50,
          portraitZoom: 1,
          portraitFit: "cover",
          updatedAt: nowIso(),
        })
        .where(eq(saints.id, saintId))
        .run();
    });
  } catch (err) {
    deletePortraitFiles(stored.portraitPath); // DB untouched → new files are unreferenced
    throw err;
  }
  if (previous && previous !== stored.portraitPath) releasePortraitIfUnused(previous, db);
  return getSaint(saintId, db)!;
}

export function removeSaintPortrait(saintId: string, db: Db = getDb()): SaintRecord {
  const row = db.select({ portraitPath: saints.portraitPath }).from(saints).where(eq(saints.id, saintId)).get();
  if (!row) throw notFound("saint");
  db.update(saints)
    .set({ portraitPath: null, portraitFocalX: 50, portraitFocalY: 50, portraitZoom: 1, portraitFit: "cover", updatedAt: nowIso() })
    .where(eq(saints.id, saintId))
    .run();
  releasePortraitIfUnused(row.portraitPath, db);
  return getSaint(saintId, db)!;
}

/**
 * Removes portrait files on disk that no saint references (e.g. after
 * "Reemplazar biblioteca"). Files younger than `minAgeMs` are kept so an
 * in-flight upload is never touched.
 */
export function cleanupOrphanPortraits(minAgeMs = 60_000, db: Db = getDb()): number {
  const referenced = new Set(
    db.select({ p: saints.portraitPath }).from(saints).where(isNotNull(saints.portraitPath)).all().map((r) => r.p),
  );
  let removed = 0;
  for (const p of listPortraitFilesOnDisk()) {
    if (referenced.has(p)) continue;
    const full = resolveServeFile(masterFilename(p));
    if (!full) continue;
    const age = Date.now() - fs.statSync(full).mtimeMs;
    if (minAgeMs > 0 && age < minAgeMs) continue;
    db.delete(portraits).where(eq(portraits.path, p)).run();
    deletePortraitFiles(p);
    removed++;
  }
  return removed;
}
