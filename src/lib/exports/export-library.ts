import { getDb, type Db } from "@/db/client";
import { listCollections } from "@/db/repositories/collections";
import { listSaints } from "@/db/repositories/saints";
import { getSetting, SETTING_KEYS } from "@/db/repositories/settings";
import {
  LIBRARY_FORMAT,
  LIBRARY_SCHEMA_VERSION,
  type LibraryFile,
  type LibrarySaint,
  type LibrarySource,
} from "@/lib/schema/library";

const DEFAULT_PORTRAIT = { focalX: 50, focalY: 50, zoom: 1, fit: "cover" } as const;

/**
 * Builds the versioned library document (same schema the importer accepts).
 * Saints keep library order; collections keep their order and member order.
 */
export function buildLibraryExport(db: Db = getDb()): LibraryFile {
  const source = getSetting<LibrarySource>(SETTING_KEYS.librarySource, db) ?? {};
  const saints: LibrarySaint[] = listSaints(db).map((s) => {
    const out: LibrarySaint = {
      id: s.id,
      name: s.name,
      birthYear: s.birthYear,
      birthYearDisplay: s.birthYearDisplay,
      ageAtDeath: s.ageAtDeath,
      ageAtDeathDisplay: s.ageAtDeathDisplay,
      country: s.country,
      portraitPath: s.portraitPath,
      isMartyr: s.isMartyr,
      categories: s.categories,
      patronages: s.patronages,
      canonizationYear: s.canonizationYear,
      characteristics: s.characteristics,
      sources: s.sources,
      reviewStatus: s.reviewStatus,
    };
    // Crop settings are an optional extension; only written when customized.
    const p = s.portrait;
    const isDefault =
      p.focalX === DEFAULT_PORTRAIT.focalX && p.focalY === DEFAULT_PORTRAIT.focalY && p.zoom === DEFAULT_PORTRAIT.zoom && p.fit === DEFAULT_PORTRAIT.fit;
    if (s.portraitPath && !isDefault) out.portrait = { ...p };
    return out;
  });
  return {
    schemaVersion: LIBRARY_SCHEMA_VERSION,
    format: LIBRARY_FORMAT,
    language: "es",
    source,
    saints,
    collections: listCollections(db).map((c) => ({ id: c.id, name: c.name, saintIds: c.saintIds })),
  };
}

export function exportFilename(prefix: string, ext: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${prefix}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.${ext}`;
}
