import { AppError, errorResponse } from "@/lib/errors";
import { previewRestore, restoreBackup } from "@/lib/exports/backup";
import { IMPORT_MODES, type ImportMode } from "@/lib/imports/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** multipart: file (zip), mode, dryRun ("true"/"false"), confirmReplace ("true"). */
export async function POST(req: Request) {
  try {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new AppError("No se recibió el archivo ZIP del respaldo.");
    const mode = String(form!.get("mode") || "replace") as ImportMode;
    if (!IMPORT_MODES.includes(mode)) throw new AppError("Modo de restauración no válido.");
    const dryRun = form!.get("dryRun") !== "false";
    const buf = new Uint8Array(await file.arrayBuffer());
    if (dryRun) return Response.json(previewRestore(buf, mode));
    const result = await restoreBackup(buf, mode, { confirmReplace: form!.get("confirmReplace") === "true" });
    return Response.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
