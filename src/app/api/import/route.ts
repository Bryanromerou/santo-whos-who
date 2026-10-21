import { z } from "zod";
import { readJson } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { importLibrary } from "@/lib/imports/import-library";
import { IMPORT_MODES, validateLibrary } from "@/lib/imports/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  data: z.unknown(),
  mode: z.enum(IMPORT_MODES).default("skip"),
  dryRun: z.boolean().default(true),
  confirmReplace: z.boolean().default(false),
});

/** Dry run (default) returns a report; with dryRun:false performs the transactional import. */
export async function POST(req: Request) {
  try {
    const body = await readJson(req, bodySchema);
    if (body.dryRun) {
      const { report } = validateLibrary(body.data, body.mode);
      return Response.json({ report });
    }
    const result = await importLibrary(body.data, body.mode, { confirmReplace: body.confirmReplace });
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
