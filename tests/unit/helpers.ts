import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { closeDb, getDb } from "@/db/client";
import { setUiLocale } from "@/db/repositories/settings";
import type { Locale } from "@/i18n/config";
import type { LibraryFile } from "@/lib/schema/library";

/**
 * Points the app at a brand-new empty data dir and returns a fresh DB.
 * The interface language is set to Spanish because most assertions check the Spanish
 * messages; pass `null` to keep the default (English) or another locale to test it.
 */
export function freshDb(uiLocale: Locale | null = "es") {
  closeDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "santos-test-"));
  process.env.SANTOS_DATA_DIR = dir;
  delete process.env.SANTOS_DATABASE_PATH;
  const db = getDb();
  if (uiLocale) setUiLocale(uiLocale, db);
  return { dir, db };
}

/** The real library file when present in seed/, otherwise the synthetic test fixture. */
export function libraryFixturePath(): string {
  const real = path.resolve("seed/santos_studio_43_santos.json");
  return fs.existsSync(real) ? real : path.resolve("tests/fixtures/library-43.json");
}

export function loadFixture(): LibraryFile {
  return JSON.parse(fs.readFileSync(libraryFixturePath(), "utf8"));
}

export function clone<T>(v: T): T {
  return structuredClone(v);
}

export async function makeImage(format: "jpeg" | "png" | "webp", w = 600, h = 800, withExif = false): Promise<Buffer> {
  let img = sharp({ create: { width: w, height: h, channels: 3, background: { r: 180, g: 120, b: 60 } } });
  if (withExif) img = img.withExif({ IFD0: { Copyright: "secreto", Artist: "Fotógrafo" } });
  return img.toFormat(format).toBuffer();
}
