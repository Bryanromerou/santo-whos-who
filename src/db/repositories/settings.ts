import { eq } from "drizzle-orm";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n/config";
import { getDb, type Db, type Tx } from "../client";
import { appSettings } from "../schema";

type Conn = Db | Tx;

export const SETTING_KEYS = {
  worksheetDraft: "worksheet.draft",
  librarySource: "library.source",
  uiLocale: "ui.locale",
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

/** Interface language; English unless another one was chosen in Settings. */
export function getUiLocale(conn: Conn = getDb()): Locale {
  const value = getSetting<unknown>(SETTING_KEYS.uiLocale, conn);
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export function setUiLocale(locale: Locale, conn: Conn = getDb()) {
  setSetting(SETTING_KEYS.uiLocale, locale, conn);
}
