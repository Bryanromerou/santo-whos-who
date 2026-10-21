import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { databasePath, migrationsDir, portraitsDir } from "@/lib/config";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;
/** Transaction handle passed to `db.transaction` callbacks. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

type Holder = { path: string; sqlite: Database.Database; db: Db };
const g = globalThis as unknown as { __santosDb?: Holder };

/**
 * Returns the singleton database connection, creating the file and running
 * pending migrations on first use. The connection is cached on globalThis so
 * Next.js dev hot reloads don't open extra handles.
 */
export function getDb(): Db {
  const file = databasePath();
  if (g.__santosDb && g.__santosDb.path === file) return g.__santosDb.db;
  if (g.__santosDb) closeDb();

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.mkdirSync(portraitsDir(), { recursive: true });

  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("busy_timeout = 5000");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: migrationsDir() });
  g.__santosDb = { path: file, sqlite, db };
  return db;
}

/** Closes the connection (used by tests and scripts). */
export function closeDb(): void {
  if (!g.__santosDb) return;
  try {
    g.__santosDb.sqlite.close();
  } finally {
    g.__santosDb = undefined;
  }
}

export { schema };

/** Raw better-sqlite3 handle (tests and maintenance only). */
export function sqliteHandle(): Database.Database {
  getDb();
  return g.__santosDb!.sqlite;
}
