/** Interface languages (client-safe: no server imports). Saint content and the printed worksheet stay Spanish. */
export const LOCALES = ["en", "es"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

/** Each language's own name, shown untranslated in the selector so it's always recognizable. */
export const LOCALE_NAMES: Record<Locale, string> = { es: "Español", en: "English" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
