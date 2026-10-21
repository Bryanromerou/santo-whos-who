import type { Messages } from "next-intl";
import { getUiLocale } from "@/db/repositories/settings";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";
import { translator } from "@/i18n/translator";

export type ErrorKey = keyof Messages["errors"];
type ErrorValues = Record<string, string | number>;

export function errorMessage(locale: Locale, key: ErrorKey, values?: ErrorValues): string {
  return (translator(locale, "errors") as (k: string, v?: ErrorValues) => string)(key, values);
}

/**
 * Error with a user-facing message (a key in messages/*.json → errors) and an HTTP status.
 * `message` is rendered in the interface language when the error is created (logs, tests);
 * `errorResponse` re-renders it for the response.
 */
export class AppError extends Error {
  readonly key: ErrorKey;
  readonly values?: ErrorValues;
  readonly status: number;
  readonly details?: unknown;

  constructor(key: ErrorKey, opts: { status?: number; values?: ErrorValues; details?: unknown } = {}) {
    super(errorMessage(requestLocale(), key, opts.values));
    this.name = "AppError";
    this.key = key;
    this.values = opts.values;
    this.status = opts.status ?? 400;
    this.details = opts.details;
  }

  messageIn(locale: Locale): string {
    return errorMessage(locale, this.key, this.values);
  }
}

export const notFound = (what: "saint" | "collection") =>
  new AppError(what === "saint" ? "saintNotFound" : "collectionNotFound", { status: 404 });

/** The interface language for server messages; falls back to the default if the database can't be read. */
export function requestLocale(): Locale {
  try {
    return getUiLocale();
  } catch {
    return DEFAULT_LOCALE;
  }
}

/** Converts any thrown value into a JSON error response in the interface language. */
export function errorResponse(err: unknown): Response {
  const locale = requestLocale();
  if (err instanceof AppError) {
    return Response.json({ error: err.messageIn(locale), details: err.details ?? null }, { status: err.status });
  }
  console.error(err);
  const msg = err instanceof Error ? err.message : String(err);
  return Response.json({ error: errorMessage(locale, "unexpected", { message: msg }) }, { status: 500 });
}
