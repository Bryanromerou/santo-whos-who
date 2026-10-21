import type { z } from "zod";
import type { Locale } from "@/i18n/config";
import { zodErrorMap } from "@/i18n/zod";
import { AppError, requestLocale } from "./errors";

/** A schema, or a builder that returns the schema with messages in the given language. */
export type LocalizedSchema<T extends z.ZodType> = T | ((locale: Locale) => T);

/** Reads and validates a JSON request body, throwing an AppError (interface language) on failure. */
export async function readJson<T extends z.ZodType>(req: Request, schema: LocalizedSchema<T>): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError("invalidJsonBody");
  }
  const locale = requestLocale();
  const s = typeof schema === "function" ? schema(locale) : schema;
  const parsed = s.safeParse(body, { error: zodErrorMap(locale) });
  if (!parsed.success) {
    const msgs = parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
    throw new AppError("invalidData", { values: { details: msgs.slice(0, 5).join(" · ") }, details: parsed.error.issues });
  }
  return parsed.data;
}

export function attachment(body: BodyInit, filename: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
