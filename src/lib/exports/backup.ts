import { createHash } from "node:crypto";
import fs from "node:fs";
import { strToU8, strFromU8, unzipSync, zipSync, type Zippable } from "fflate";
import sharp from "sharp";
import { getDb, type Db } from "@/db/client";
import { getSetting, setSetting, SETTING_KEYS } from "@/db/repositories/settings";
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
 *   settings.json        — worksheet preferences
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
  add("settings.json", strToU8(JSON.stringify({ worksheetDraft: getSetting(SETTING_KEYS.worksheetDraft, db) }, null, 2)));

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
  settings?: { worksheetDraft?: unknown };
  /** master path (uploads/saints/<uuid>.jpg) → { master, thumb? } */
  images: Map<string, { master: Uint8Array; thumb?: Uint8Array }>;
};

/** Unzips and verifies a backup without touching disk or DB. */
export function parseBackupZip(buf: Uint8Array): ParsedBackup {
  const errors: string[] = [];
  const images: ParsedBackup["images"] = new Map();
  let entries: Record<string, Uint8Array>;
  try {
    let total = 0;
    entries = unzipSync(buf, {
      filter: (f) => {
        total += f.originalSize;
        if (total > MAX_BACKUP_BYTES) throw new Error("demasiado grande");
        return !f.name.endsWith("/");
      },
    });
  } catch (e) {
    return { errors: [`No se pudo abrir el ZIP: ${(e as Error).message}`], images };
  }

  const manifestRaw = entries["manifest.json"];
  if (!manifestRaw) return { errors: ["El ZIP no contiene manifest.json; no parece un respaldo de Santos Studio."], images };
  let manifest: BackupManifest;
  try {
    manifest = JSON.parse(strFromU8(manifestRaw));
  } catch {
    return { errors: ["manifest.json no es JSON válido."], images };
  }
  if (manifest.format !== BACKUP_FORMAT) errors.push(`Formato de respaldo desconocido: «${String(manifest.format)}».`);
  if (manifest.version !== BACKUP_VERSION) errors.push(`Versión de respaldo no compatible: ${String(manifest.version)}.`);
  if (!Array.isArray(manifest.files)) errors.push("manifest.json no lista los archivos del respaldo.");
  if (errors.length) return { errors, manifest, images };

  const listed = new Set<string>();
  for (const f of manifest.files) {
    listed.add(f.path);
    const data = entries[f.path];
    if (!data) {
      errors.push(`Falta el archivo «${f.path}» indicado en el manifiesto.`);
      continue;
    }
    if (data.length !== f.bytes || sha256(data) !== f.sha256) errors.push(`El archivo «${f.path}» está dañado (la suma de verificación no coincide).`);
  }
  for (const name of Object.keys(entries)) {
    if (name !== "manifest.json" && !listed.has(name)) errors.push(`Archivo inesperado en el respaldo: «${name}».`);
  }

  for (const [name, data] of Object.entries(entries)) {
    if (!name.startsWith("portraits/")) continue;
    const file = name.slice("portraits/".length);
    if (!SERVE_FILENAME_RE.test(file)) {
      errors.push(`Nombre de imagen no permitido: «${name}».`);
      continue;
    }
    if (detectImageFormat(data) !== "jpeg") {
      errors.push(`«${name}» no es una imagen JPG válida.`);
      continue;
    }
    const master = `uploads/saints/${file.replace(".thumb.jpg", ".jpg")}`;
    const entry = images.get(master) ?? { master: new Uint8Array() };
    if (file.includes(".thumb.")) entry.thumb = data;
    else entry.master = data;
    images.set(master, entry);
  }
  for (const [p, e] of images) if (e.master.length === 0) errors.push(`Falta la imagen principal de «${p}».`);

  let libraryRaw: unknown;
  if (!entries["library.json"]) errors.push("El respaldo no contiene library.json.");
  else {
    try {
      libraryRaw = JSON.parse(strFromU8(entries["library.json"]));
    } catch {
      errors.push("library.json no es JSON válido.");
    }
  }
  let settings: ParsedBackup["settings"];
  if (entries["settings.json"]) {
    try {
      settings = JSON.parse(strFromU8(entries["settings.json"]));
    } catch {
      errors.push("settings.json no es JSON válido.");
    }
  }
  return { errors, manifest, libraryRaw, settings, images };
}

export type RestorePreview = { report: ImportReport; manifest?: BackupManifest; portraits: number };

export function previewRestore(buf: Uint8Array, mode: ImportMode, db: Db = getDb()): RestorePreview {
  const parsed = parseBackupZip(buf);
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
  const parsed = parseBackupZip(buf);
  if (parsed.errors.length || parsed.libraryRaw === undefined) {
    throw new AppError("El respaldo no es válido y no se restauró nada.", 422, failedReport(parsed.errors, mode));
  }
  const { report } = validateLibrary(parsed.libraryRaw, mode, { availablePortraits: new Set(parsed.images.keys()) }, db);
  if (!report.ok) throw new AppError("El respaldo tiene errores y no se restauró nada.", 422, report);
  if (mode === "replace" && !opts.confirmReplace) {
    throw new AppError("Reemplazar la biblioteca requiere confirmación explícita.", 400, report);
  }

  for (const [p, img] of parsed.images) {
    try {
      const m = await sharp(img.master).metadata();
      if (m.format !== "jpeg") throw new Error();
    } catch {
      throw new AppError(`La imagen «${p}» del respaldo está dañada.`, 422);
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
    return { ...result, portraitsRestored: written.length };
  } catch (err) {
    for (const p of written) deletePortraitFiles(p);
    throw err;
  }
}
