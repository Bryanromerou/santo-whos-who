import { z } from "zod";
import type { Locale } from "./config";

const ZOD_LOCALES = { es: z.locales.es, en: z.locales.en } satisfies Record<Locale, () => { localeError: z.core.$ZodErrorMap }>;
const zodMaps = new Map<Locale, z.core.$ZodErrorMap>();

/**
 * Zod's built-in messages for one locale, passed per parse (`{ error: zodErrorMap(locale) }`).
 * Per-parse maps keep concurrent requests independent; nothing changes Zod's global config
 * (which is Zod's default English).
 */
export function zodErrorMap(locale: Locale): z.core.$ZodErrorMap {
  let map = zodMaps.get(locale);
  if (!map) zodMaps.set(locale, (map = ZOD_LOCALES[locale]().localeError));
  return map;
}
