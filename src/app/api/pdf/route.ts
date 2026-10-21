import { readJson } from "@/lib/api";
import { AppError, errorResponse } from "@/lib/errors";
import { exportFilename } from "@/lib/exports/export-library";
import { renderWorksheetPdf } from "@/lib/pdf/render-pdf";
import { encodeConfig, worksheetConfigSchema } from "@/lib/worksheet/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Renders the worksheet to PDF through headless Chromium using the /imprimir view. */
export async function POST(req: Request) {
  try {
    const config = await readJson(req, worksheetConfigSchema);
    if (config.saintIds.length === 0) throw new AppError("Selecciona al menos un santo para crear fichas.");
    // Always loop back to this same local server (never an external host).
    const self = new URL(req.url);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(self.hostname)) {
      throw new AppError("La exportación a PDF solo funciona cuando la app se abre en este equipo (127.0.0.1).", 403);
    }
    const origin = self.origin;
    const url = `${origin}/imprimir?pdf=1&c=${encodeConfig(config)}`;
    const pdf = await renderWorksheetPdf(url);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${exportFilename("fichas-santos", "pdf")}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
