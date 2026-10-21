import en from "../../messages/en.json";
import es from "../../messages/es.json";
import type { Locale } from "./config";

/** es.json's shape types every `t()` key (see global.d.ts); en.json must have exactly the same keys. */
export type AppMessages = typeof es;

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
type SameKeys<A, B> = [Exclude<Leaves<A>, Leaves<B>>, Exclude<Leaves<B>, Leaves<A>>] extends [never, never] ? true : never;

// Fails `tsc` when en.json is missing a key from es.json (or has one es.json doesn't).
const keysMatch: SameKeys<typeof es, typeof en> = true;
void keysMatch;

export const messages: Record<Locale, AppMessages> = { es, en };
