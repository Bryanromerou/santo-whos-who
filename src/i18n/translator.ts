import { createTranslator, type Messages, type NamespaceKeys, type NestedKeyOf } from "next-intl";
import type { Locale } from "./config";
import { messages } from "./messages";

export type Namespace = NamespaceKeys<Messages, NestedKeyOf<Messages>>;

/**
 * Translator usable anywhere (route handlers, lib code, tests) — no request
 * context needed, so callers pass the locale explicitly.
 */
export function translator<N extends Namespace>(locale: Locale, namespace: N) {
  return createTranslator({ locale, messages: messages[locale], namespace });
}

/** Memoizes a per-language builder (e.g. a Zod schema with translated messages). */
export function perLocale<T>(build: (locale: Locale) => T): (locale: Locale) => T {
  const cache = new Map<Locale, T>();
  return (locale) => {
    if (!cache.has(locale)) cache.set(locale, build(locale));
    return cache.get(locale)!;
  };
}

export { loose, type LooseT } from "./loose";
