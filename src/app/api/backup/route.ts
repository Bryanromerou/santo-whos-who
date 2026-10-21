import { attachment } from "@/lib/api";
import { errorResponse } from "@/lib/errors";
import { createBackupZip } from "@/lib/exports/backup";
import { exportFilename } from "@/lib/exports/export-library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const zip = createBackupZip();
    return attachment(new Uint8Array(zip), exportFilename("santos-studio-respaldo", "zip"), "application/zip");
  } catch (e) {
    return errorResponse(e);
  }
}
