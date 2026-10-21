import { eq } from "drizzle-orm";
import sharp from "sharp";
import { getDb, type Db } from "@/db/client";
import { collectionExists, getCollection, insertCollection, writeMembers } from "@/db/repositories/collections";
import { getSetting, setSetting, SETTING_KEYS } from "@/db/repositories/settings";
import { insertSaint, nextSortOrder, nowIso, saintExists, scalarColumns, writeSaintChildren, type SaintData } from "@/db/repositories/saints";
import { collections, portraits, saints } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { cleanupOrphanPortraits } from "@/lib/images/portrait-service";
import { isValidPortraitPath, masterFilename, portraitFileExists, resolveServeFile, thumbFilename } from "@/lib/images/storage";
import type { LibrarySaint } from "@/lib/schema/library";
import { pluralize } from "@/lib/text";
import { validateLibrary, type ImportMode, type ImportReport } from "./validate";

export type ImportResult = {
  report: ImportReport;
  counts: {
    saintsCreated: number;
    saintsUpdated: number;
    saintsSkipped: number;
    saintsDeleted: number;
    characteristics: number;
    collectionsCreated: number;
    collectionsUpdated: number;
    collectionsSkipped: number;
    collectionsMerged: number;
    membershipsAdded: number;
  };
  summary: string;
};

function toSaintData(s: LibrarySaint, portraitPath: string | null): SaintData {
  return {
    name: s.name,
    birthYear: s.birthYear,
    birthYearDisplay: s.birthYearDisplay,
    ageAtDeath: s.ageAtDeath,
    ageAtDeathDisplay: s.ageAtDeathDisplay,
    country: s.country,
    canonizationYear: s.canonizationYear,
    isMartyr: s.isMartyr,
    reviewStatus: s.reviewStatus,
    portraitPath,
    portrait: s.portrait ?? { focalX: 50, focalY: 50, zoom: 1, fit: "cover" },
    categories: s.categories,
    patronages: s.patronages,
    sources: s.sources,
    characteristics: s.characteristics.map((c) => ({ id: c.id, text: c.text, type: c.type })),
  };
}

type PortraitMeta = { path: string; width: number; height: number; bytes: number };

async function readPortraitMeta(paths: string[]): Promise<Map<string, PortraitMeta>> {
  const out = new Map<string, PortraitMeta>();
  for (const p of paths) {
    const full = resolveServeFile(masterFilename(p));
    if (!full) continue;
    try {
      const m = await sharp(full).metadata();
      out.set(p, { path: p, width: m.width ?? 0, height: m.height ?? 0, bytes: m.size ?? 0 });
    } catch {
      // Unreadable file: the saint is imported without a portrait.
    }
  }
  return out;
}

/**
 * Validates the whole file first, then imports everything in ONE SQLite
 * transaction. If validation fails nothing is written; if any write fails the
 * transaction rolls back and the library is unchanged.
 */
export async function importLibrary(
  raw: unknown,
  mode: ImportMode,
  opts: { confirmReplace?: boolean; availablePortraits?: Set<string> } = {},
  db: Db = getDb(),
): Promise<ImportResult> {
  const { report, data } = validateLibrary(raw, mode, { availablePortraits: opts.availablePortraits }, db);
  if (!data || !report.ok) {
    throw new AppError("El archivo tiene errores y no se importó nada.", 422, report);
  }
  if (mode === "replace" && !opts.confirmReplace) {
    throw new AppError("Reemplazar la biblioteca requiere confirmación explícita.", 400, report);
  }

  // Portrait files referenced by the file must already exist on disk (backup restore writes them first).
  const wantedPortraits = [...new Set(data.saints.map((s) => s.portraitPath).filter((p): p is string => isValidPortraitPath(p) && portraitFileExists(p)))];
  const portraitMeta = await readPortraitMeta(wantedPortraits);

  const counts: ImportResult["counts"] = {
    saintsCreated: 0,
    saintsUpdated: 0,
    saintsSkipped: 0,
    saintsDeleted: 0,
    characteristics: 0,
    collectionsCreated: 0,
    collectionsUpdated: 0,
    collectionsSkipped: 0,
    collectionsMerged: 0,
    membershipsAdded: 0,
  };

  db.transaction((tx) => {
    if (mode === "replace") {
      counts.saintsDeleted = tx.select({ id: saints.id }).from(saints).all().length;
      tx.delete(collections).run();
      tx.delete(saints).run(); // children + memberships cascade
    }

    for (const p of portraitMeta.values()) {
      tx.insert(portraits)
        .values({ path: p.path, thumbPath: `uploads/saints/${thumbFilename(p.path)}`, width: p.width, height: p.height, bytes: p.bytes, sourceFormat: "jpeg" })
        .onConflictDoNothing()
        .run();
    }

    let order = nextSortOrder(tx);
    for (const s of data.saints) {
      const portraitPath = s.portraitPath && portraitMeta.has(s.portraitPath) ? s.portraitPath : null;
      const exists = saintExists(s.id, tx);
      if (exists && mode === "skip") {
        counts.saintsSkipped++;
        continue;
      }
      if (exists && mode === "update") {
        const current = tx.select().from(saints).where(eq(saints.id, s.id)).get()!;
        const keepPortrait = portraitPath === null && current.portraitPath !== null;
        const d = toSaintData(s, keepPortrait ? current.portraitPath : portraitPath);
        if (keepPortrait && !s.portrait) {
          d.portrait = { focalX: current.portraitFocalX, focalY: current.portraitFocalY, zoom: current.portraitZoom, fit: current.portraitFit };
        }
        tx.update(saints).set({ ...scalarColumns(d), updatedAt: nowIso() }).where(eq(saints.id, s.id)).run();
        writeSaintChildren(tx, s.id, d);
        counts.saintsUpdated++;
        counts.characteristics += s.characteristics.length;
        continue;
      }
      insertSaint(tx, s.id, toSaintData(s, portraitPath), order++);
      counts.saintsCreated++;
      counts.characteristics += s.characteristics.length;
    }

    for (const c of data.collections) {
      const exists = collectionExists(c.id, tx);
      if (exists && mode === "skip") {
        // Keep everyone already in the collection; append the file's new members in file order.
        const current = getCollection(c.id, tx)!.saintIds;
        const additions = c.saintIds.filter((id) => !current.includes(id));
        if (additions.length) {
          writeMembers(tx, c.id, [...current, ...additions]);
          tx.update(collections).set({ updatedAt: nowIso() }).where(eq(collections.id, c.id)).run();
          counts.collectionsMerged++;
          counts.membershipsAdded += additions.length;
        } else {
          counts.collectionsSkipped++;
        }
        continue;
      }
      if (exists && mode === "update") {
        tx.update(collections).set({ name: c.name, updatedAt: nowIso() }).where(eq(collections.id, c.id)).run();
        writeMembers(tx, c.id, c.saintIds);
        counts.collectionsUpdated++;
        continue;
      }
      insertCollection(tx, c.id, c.name, c.saintIds);
      counts.collectionsCreated++;
    }

    if (mode === "replace" || !getSetting(SETTING_KEYS.librarySource, tx)) {
      setSetting(SETTING_KEYS.librarySource, data.source ?? {}, tx);
    }
  });

  if (mode === "replace") cleanupOrphanPortraits(60_000, db);

  const importedSaints = counts.saintsCreated + counts.saintsUpdated;
  const importedCollections = counts.collectionsCreated + counts.collectionsUpdated;
  const parts = [
    `${pluralize(importedSaints, "santo importado", "santos importados")}`,
    pluralize(counts.characteristics, "característica", "características"),
    pluralize(importedCollections, "colección", "colecciones"),
  ];
  if (counts.membershipsAdded) {
    parts.push(
      `${pluralize(counts.membershipsAdded, "santo añadido", "santos añadidos")} a ${pluralize(counts.collectionsMerged, "colección existente", "colecciones existentes")}`,
    );
  }
  if (counts.saintsSkipped) parts.push(`${pluralize(counts.saintsSkipped, "santo existente saltado", "santos existentes saltados")}`);
  return { report, counts, summary: parts.join(" · ") };
}
