import "server-only";
import fs from "node:fs";
import { listCollections } from "@/db/repositories/collections";
import { collectionIdsBySaint, listSaints, type SaintRecord } from "@/db/repositories/saints";
import { seedFilePath } from "@/lib/config";
import { portraitFileExists, portraitUrls } from "@/lib/images/storage";
import { ageDisplay, birthDisplay } from "@/lib/worksheet/card-data";

/** Lightweight row for the library table (search text precomputed server-side). */
export type LibraryRow = {
  id: string;
  name: string;
  country: string;
  birth: string;
  age: string;
  isMartyr: boolean;
  categories: string[];
  reviewStatus: SaintRecord["reviewStatus"];
  characteristicCount: number;
  canonizationYear: number | null;
  thumb: string | null;
  hasMissingPortrait: boolean;
  collectionIds: string[];
  searchText: string;
};

export type CollectionSummary = { id: string; name: string; saintIds: string[] };

export function getLibraryView() {
  const memberships = collectionIdsBySaint();
  const rows: LibraryRow[] = listSaints().map((s) => {
    const exists = portraitFileExists(s.portraitPath);
    return {
      id: s.id,
      name: s.name,
      country: s.country,
      birth: birthDisplay(s),
      age: ageDisplay(s),
      isMartyr: s.isMartyr,
      categories: s.categories,
      reviewStatus: s.reviewStatus,
      characteristicCount: s.characteristics.length,
      canonizationYear: s.canonizationYear,
      thumb: exists ? portraitUrls(s.portraitPath)!.thumb : null,
      hasMissingPortrait: !!s.portraitPath && !exists,
      collectionIds: memberships.get(s.id) ?? [],
      searchText: [s.name, s.country, ...s.patronages, ...s.characteristics.map((c) => c.text)].join(" \n "),
    };
  });
  const collections: CollectionSummary[] = listCollections().map((c) => ({ id: c.id, name: c.name, saintIds: c.saintIds }));
  return { rows, collections, seedAvailable: fs.existsSync(seedFilePath()) };
}
