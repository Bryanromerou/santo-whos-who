import path from "node:path";

/**
 * Runtime configuration. Values are read lazily so tests can point the app at
 * a temporary data directory by changing environment variables.
 */
export function dataDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), process.env.SANTOS_DATA_DIR || "data");
}

export function databasePath(): string {
  const explicit = process.env.SANTOS_DATABASE_PATH;
  return explicit ? path.resolve(/*turbopackIgnore: true*/ process.cwd(), explicit) : path.join(/*turbopackIgnore: true*/ dataDir(), "santos.sqlite");
}

/** Folder where portrait image files live (relative paths in the DB start with `uploads/saints/`). */
export function portraitsDir(): string {
  return path.join(/*turbopackIgnore: true*/ dataDir(), "uploads", "saints");
}

export function migrationsDir(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), "drizzle");
}

export function seedFilePath(): string {
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), "seed", "santos_studio_43_santos.json");
}

export function maxUploadBytes(): number {
  const mb = Number(process.env.SANTOS_MAX_UPLOAD_MB || 10);
  return Math.max(1, Number.isFinite(mb) ? mb : 10) * 1024 * 1024;
}
