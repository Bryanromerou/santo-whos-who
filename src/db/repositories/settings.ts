import { eq } from "drizzle-orm";
import { getDb, type Db, type Tx } from "../client";
import { appSettings } from "../schema";

type Conn = Db | Tx;

export const SETTING_KEYS = {
  worksheetDraft: "worksheet.draft",
  librarySource: "library.source",
} as const;

export function getSetting<T>(key: string, conn: Conn = getDb()): T | null {
  const row = conn.select().from(appSettings).where(eq(appSettings.key, key)).get();
  return row ? (row.value as T) : null;
}

export function setSetting(key: string, value: unknown, conn: Conn = getDb()) {
  const updatedAt = new Date().toISOString();
  conn
    .insert(appSettings)
    .values({ key, value, updatedAt })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt } })
    .run();
}
