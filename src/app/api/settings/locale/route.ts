import { z } from "zod";
import { getUiLocale, setUiLocale } from "@/db/repositories/settings";
import { LOCALES } from "@/i18n/config";
import { readJson } from "@/lib/api";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ locale: getUiLocale() });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Changes the interface language (saint content and printed worksheets stay Spanish). */
export async function PUT(req: Request) {
  try {
    const { locale } = await readJson(req, z.object({ locale: z.enum(LOCALES) }));
    setUiLocale(locale);
    return Response.json({ locale });
  } catch (e) {
    return errorResponse(e);
  }
}
