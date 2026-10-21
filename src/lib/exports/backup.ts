import { createHash } from "node:crypto";
import fs from "node:fs";
import { strToU8, strFromU8, unzipSync, zipSync, type Zippable } from "fflate";
import sharp from "sharp";
import { getDb, type Db } from "@/db/client";
import { getSetting, getUiLocale, setSetting, setUiLocale, SETTING_KEYS } from "@/db/repositories/settings";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { loose, translator } from "@/i18n/translator";
import { AppError } from "@/lib/errors";
import { importLibrary, type ImportResult } from "@/lib/imports/import-library";
import { failedReport, validateLibrary, type ImportMode, type ImportReport } from "@/lib/imports/validate";
import { detectImageFormat } from "@/lib/images/process";
import {
  deletePortraitFiles,
  isValidPortraitPath,
  masterFilename,
  portraitFileExists,
  resolveServeFile,
  SERVE_FILENAME_RE,
  thumbFilename,
  writeFileAtomic,
} from "@/lib/images/storage";
import { buildLibraryExport } from "./export-library";

export const BACKUP_FORMAT = "santos-studio-backup";
export const BACKUP_VERSION = 1;
const MAX_BACKUP_BYTES = 1024 * 1024 * 1024; // 1 GB uncompressed safety cap

type ManifestFile = { path: string; bytes: number; sha256: string };
export type BackupManifest = {
  format: typeof BACKUP_FORMAT;
  version: number;
  createdAt: string;
  app: string;
  counts: { saints: number; characteristics: number; collections: number; portraits: number };
  files: ManifestFile[];
};

const sha256 = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");

/**
 * ZIP layout:
 *   manifest.json        — format/version, counts, sha256 of every file
 *   library.json         — same schema as "Exportar JSON"
 *   settings.json        — worksheet preferences and interface language
 *   portraits/<uuid>.jpg — master images (+ .thumb.jpg thumbnails)
 */
export function createBackupZip(db: Db = getDb()): Uint8Array {
  const library = buildLibraryExport(db);
  const files: Zippable = {};
  const manifestFiles: ManifestFile[] = [];
  const add = (path: string, data: Uint8Array) => {
    files[path] = data;
    manifestFiles.push({ path, bytes: data.length, sha256: sha256(data) });
  };

  add("library.json", strToU8(JSON.stringify(library, null, 2)));
  const settings = { worksheetDraft: getSetting(SETTING_KEYS.worksheetDraft, db), uiLocale: getUiLocale(db) };
  add("settings.json", strToU8(JSON.stringify(settings, null, 2)));

  const portraitPaths = [...new Set(library.saints.map((s) => s.portraitPath).filter((p): p is string => isValidPortraitPath(p)))];
  let portraitsCount = 0;
  for (const p of portraitPaths) {
    const master = resolveServeFile(masterFilename(p));
    const thumb = resolveServeFile(thumbFilename(p));
    if (!master || !fs.existsSync(master)) continue;
    add(`portraits/${masterFilename(p)}`, fs.readFileSync(master));
    if (thumb && fs.existsSync(thumb)) add(`portraits/${thumbFilename(p)}`, fs.readFileSync(thumb));
    portraitsCount++;
  }

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    app: "Santos Studio",
    counts: {
      saints: library.saints.length,
      characteristics: library.saints.reduce((n, s) => n + s.characteristics.length, 0),
      collections: library.collections.length,
      portraits: portraitsCount,
    },
    files: manifestFiles,
  };
  // JPEGs are already compressed; store them to save CPU.
  const zippable: Zippable = { "manifest.json": strToU8(JSON.stringify(manifest, null, 2)) };
  for (const [k, v] of Object.entries(files)) zippable[k] = k.endsWith(".jpg") ? [v as Uint8Array, { level: 0 }] : (v as Uint8Array);
  return zipSync(zippable, { level: 6 });
}

export type ParsedBackup = {
  errors: string[];
  manifest?: BackupManifest;
  libraryRaw?: unknown;
  settings?: { worksheetDraft?: unknown; uiLocale?: unknown };
  /** master path (uploads/saints/<uuid>.jpg) → { master, thumb? } */
  images: Map<string, { master: Uint8Array; thumb?: Uint8Array }>;
};

/** Unzips and verifies a backup without touching disk or DB. Messages are in `locale`. */
export function parseBackupZip(buf: Uint8Array, locale: Locale = DEFAULT_LOCALE): ParsedBackup {
  const t = loose(translator(locale, "backup.report"));
  const errors: string[] = [];
  const images: ParsedBackup["images"] = new Map();
  let entries: Record<string, Uint8Array>;
  try {
    let total = 0;
    entries = unzipSync(buf, {
      filter: (f) => {
        total += f.originalSize;
        if (total > MAX_BACKUP_BYTES) throw new Error(t("tooLarge"));
        return !f.name.endsWith("/");
      },
    });
  } catch (e) {
    return { errors: [t("cannotOpenZip", { message: (e as Error).message })], images };
  }

  const manifestRaw = entries["manifest.json"];
  if (!manifestRaw) return { errors: [t("noManifest")], images };
  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(strFromU8(manifestRaw));
  } catch {
    return { errors: [t("invalidJson", { file: "manifest.json" })], images };
  }
  if (manifest.format !== BACKUP_FORMAT) errors.push(t("unknownFormat", { format: String(manifest.format) }));
  if (manifest.version !== BACKUP_VERSION) errors.push(t("unsupportedVersion", { version: String(manifest.version) }));
  if (!Array.isArray(manifest.files)) errors.push(t("manifestNoFiles"));
  if (errors.length) return { errors, manifest, images };

  const listed = new Set<string>();
  for (const f of manifest.files) {
    listed.add(f.path);
    const data = entries[f.path];
    if (!data) {
      errors.push(t("missingFile", { path: f.path }));
      continue;
    }
    if (data.length !== f.bytes || sha256(data) !== f.sha256) errors.push(t("damagedFile", { path: f.path }));
  }
  for (const name of Object.keys(entries)) {
    if (name !== "manifest.json" && !listed.has(name)) errors.push(t("unexpectedFile", { path: name }));
  }

  for (const [name, data] of Object.entries(entries)) {
    if (!name.startsWith("portraits/")) continue;
    const file = name.slice("portraits/".length);
    if (!SERVE_FILENAME_RE.test(file)) {
      errors.push(t("badImageName", { path: name }));
      continue;
    }
    if (detectImageFormat(data) !== "jpeg") {
      errors.push(t("notJpeg", { path: name }));
      continue;
    }
    const master = `uploads/saints/${file.replace(".thumb.jpg", ".jpg")}`;
    const entry = images.get(master) ?? { master: new Uint8Array() };
    if (file.includes(".thumb.")) entry.thumb = data;
    else entry.master = data;
    images.set(master, entry);
  }
  for (const [p, e] of images) if (e.master.length === 0) errors.push(t("missingMaster", { path: p }));

  let libraryRaw: unknown;
  if (!entries["library.json"]) errors.push(t("noLibrary"));
  else {
    try {
      libraryRaw = JSON.parse(strFromU8(entries["library.json"]));
    } catch {
      errors.push(t("invalidJson", { file: "library.json" }));
    }
  }
  let settings: ParsedBackup["settings"];
  if (entries["settings.json"]) {
    try {
      settings = JSON.parse(strFromU8(entries["settings.json"]));
    } catch {
      errors.push(t("invalidJson", { file: "settings.json" }));
    }
  }
  return { errors, manifest, libraryRaw, settings, images };
}

export type RestorePreview = { report: ImportReport; manifest?: BackupManifest; portraits: number };

export function previewRestore(buf: Uint8Array, mode: ImportMode, db: Db = getDb()): RestorePreview {
  const parsed = parseBackupZip(buf, getUiLocale(db));
  if (parsed.errors.length || parsed.libraryRaw === undefined) {
    return { report: failedReport(parsed.errors, mode), manifest: parsed.manifest, portraits: 0 };
  }
  const { report } = validateLibrary(parsed.libraryRaw, mode, { availablePortraits: new Set(parsed.images.keys()) }, db);
  return { report, manifest: parsed.manifest, portraits: parsed.images.size };
}

/**
 * Restores a backup: validates everything, re-checks images with Sharp, writes
 * only the image files that aren't already present, then runs the transactional
 * import. If the import fails, newly written images are removed again.
 */
export async function restoreBackup(
  buf: Uint8Array,
  mode: ImportMode,
  opts: { confirmReplace?: boolean },
  db: Db = getDb(),
): Promise<ImportResult & { portraitsRestored: number }> {
  const parsed = parseBackupZip(buf, getUiLocale(db));
  if (parsed.errors.length || parsed.libraryRaw === undefined) {
    throw new AppError("backupInvalid", { status: 422, details: failedReport(parsed.errors, mode) });
  }
  const { report } = validateLibrary(parsed.libraryRaw, mode, { availablePortraits: new Set(parsed.images.keys()) }, db);
  if (!report.ok) throw new AppError("backupHasErrors", { status: 422, details: report });
  if (mode === "replace" && !opts.confirmReplace) {
    throw new AppError("replaceNeedsConfirmation", { details: report });
  }

  for (const [p, img] of parsed.images) {
    try {
      const m = await sharp(img.master).metadata();
      if (m.format !== "jpeg") throw new Error();
    } catch {
      throw new AppError("backupImageDamaged", { status: 422, values: { path: p } });
    }
  }

  const written: string[] = [];
  for (const [p, img] of parsed.images) {
    if (portraitFileExists(p)) continue; // same UUID already on this computer
    writeFileAtomic(resolveServeFile(masterFilename(p))!, Buffer.from(img.master));
    const thumb = img.thumb ?? (await sharp(img.master).resize({ width: 480, height: 480, fit: "inside" }).jpeg({ quality: 80 }).toBuffer());
    writeFileAtomic(resolveServeFile(thumbFilename(p))!, Buffer.from(thumb));
    written.push(p);
  }

  try {
    const result = await importLibrary(parsed.libraryRaw, mode, { confirmReplace: opts.confirmReplace }, db);
    if (parsed.settings?.worksheetDraft && (mode === "replace" || !getSetting(SETTING_KEYS.worksheetDraft, db))) {
      setSetting(SETTING_KEYS.worksheetDraft, parsed.settings.worksheetDraft, db);
    }
    // Same rule for the interface language: a full replace brings it back; otherwise only if never chosen here.
    const uiLocale = parsed.settings?.uiLocale;
    if (isLocale(uiLocale) && (mode === "replace" || getSetting(SETTING_KEYS.uiLocale, db) === null)) setUiLocale(uiLocale, db);
    return { ...result, portraitsRestored: written.length };
  } catch (err) {
    for (const p of written) deletePortraitFiles(p);
    throw err;
  }
}
