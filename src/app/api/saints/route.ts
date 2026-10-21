import { z } from "zod";
import { createSaint, listSaints, setReviewStatus } from "@/db/repositories/saints";
import { REVIEW_STATUSES } from "@/db/schema";
import { readJson } from "@/lib/api";
import { perLocale, translator } from "@/i18n/translator";
import { errorResponse } from "@/lib/errors";
import { saintInputSchemaFor } from "@/lib/schema/saint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ saints: listSaints() });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const input = await readJson(req, saintInputSchemaFor);
    return Response.json({ saint: createSaint(input) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

const bulkReviewSchema = perLocale((locale) =>
  z.object({
    saintIds: z.array(z.string()).min(1, { error: translator(locale, "validation")("selectAtLeastOneSaint") }).max(1000),
    reviewStatus: z.enum(REVIEW_STATUSES),
  }),
);

/** Bulk action: mark many saints as reviewed (or back to pending). */
export async function PATCH(req: Request) {
  try {
    const { saintIds, reviewStatus } = await readJson(req, bulkReviewSchema);
    return Response.json({ updated: setReviewStatus(saintIds, reviewStatus) });
  } catch (e) {
    return errorResponse(e);
  }
}
