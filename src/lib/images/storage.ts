import fs from "node:fs";
import path from "node:path";
import { portraitsDir } from "@/lib/config";

/**
 * Portrait files are named `<uuid>.jpg` (master) and `<uuid>.thumb.jpg` (thumbnail).
 * The DB stores the master path relative to the data dir: `uploads/saints/<uuid>.jpg`.
 */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
export const SERVE_FILENAME_RE = new RegExp(`^${UUID}(\\.thumb)?\\.jpg$`);
export const PORTRAIT_PATH_RE = new RegExp(`^uploads/saints/(${UUID})\\.jpg$`);
const PATH_PREFIX = "uploads/saints/";

export function isValidPortraitPath(p: string | null | undefined): p is string {
  return typeof p === "string" && PORTRAIT_PATH_RE.test(p);
}

export function portraitPathFor(uuid: string): string {
  return `${PATH_PREFIX}${uuid}.jpg`;
}

export function masterFilename(portraitPath: string): string {
  return portraitPath.slice(PATH_PREFIX.length);
}

export function thumbFilename(portraitPath: string): string {
  return masterFilename(portraitPath).replace(/\.jpg$/, ".thumb.jpg");
}

/** Resolves a whitelisted filename to an absolute path inside the portraits dir, or null. */
export function resolveServeFile(filename: string): string | null {
  if (!SERVE_FILENAME_RE.test(filename)) return null;
  const dir = portraitsDir();
  const full = path.resolve(/*turbopackIgnore: true*/ dir, filename);
  if (path.dirname(full) !== dir) return null; // defense in depth against traversal
  return full;
}

export function portraitFileExists(portraitPath: string | null): boolean {
  if (!isValidPortraitPath(portraitPath)) return false;
  const full = resolveServeFile(masterFilename(portraitPath));
  return !!full && fs.existsSync(/*turbopackIgnore: true*/ full);
}

/** Public URLs used by the UI and the print view (same origin → no CORS issues). */
export function portraitUrls(portraitPath: string | null): { master: string; thumb: string } | null {
  if (!isValidPortraitPath(portraitPath)) return null;
  return {
    master: `/api/portraits/${masterFilename(portraitPath)}`,
    thumb: `/api/portraits/${thumbFilename(portraitPath)}`,
  };
}

/** Writes a file atomically (temp file + rename). */
export function writeFileAtomic(full: string, data: Buffer) {
  fs.mkdirSync(path.dirname(full), { recursive: true });
  const tmp = `${full}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, full);
}

/** Deletes master and thumbnail files of a portrait path. Missing files are ignored. */
export function deletePortraitFiles(portraitPath: string) {
  if (!isValidPortraitPath(portraitPath)) return;
  for (const name of [masterFilename(portraitPath), thumbFilename(portraitPath)]) {
    const full = resolveServeFile(name);
    if (full) fs.rmSync(full, { force: true });
  }
}

/** Lists master portrait paths present on disk. */
export function listPortraitFilesOnDisk(): string[] {
  const dir = portraitsDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => SERVE_FILENAME_RE.test(f) && !f.includes(".thumb."))
    .map((f) => `${PATH_PREFIX}${f}`);
}
