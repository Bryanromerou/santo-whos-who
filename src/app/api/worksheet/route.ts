import { readJson } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { worksheetConfigSchema } from "@/lib/worksheet/settings";
import { getWorksheetDraft, saveWorksheetDraft } from "@/lib/worksheet/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ config: getWorksheetDraft() });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Persists the builder's selection, order and print settings locally. */
export async function PUT(req: Request) {
  try {
    const config = await readJson(req, worksheetConfigSchema);
    saveWorksheetDraft(config);
    return Response.json({ config });
  } catch (e) {
    return errorResponse(e);
  }
}
