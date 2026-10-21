import { attachment } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { buildLibraryExport, exportFilename } from "@/lib/exports/export-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const json = JSON.stringify(buildLibraryExport(), null, 2);
    return attachment(json, exportFilename("santos-studio-biblioteca", "json"), "application/json; charset=utf-8");
  } catch (e) {
    return errorResponse(e);
  }
}
