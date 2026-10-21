import type { z } from "zod";
import { AppError } from "./errors";

/** Reads and validates a JSON request body, throwing a Spanish AppError on failure. */
export async function readJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError("La solicitud no contiene JSON válido.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const msgs = parsed.error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
    throw new AppError(`Datos no válidos: ${msgs.slice(0, 5).join(" · ")}`, 400, parsed.error.issues);
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
