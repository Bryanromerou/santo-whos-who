import { maxUploadBytes } from "@/lib/config";
import { AppError, errorResponse } from "@/lib/errors";
import { removeSaintPortrait, setSaintPortrait } from "@/lib/images/portrait-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Upload or replace a saint's portrait (multipart field "file"). */
export async function POST(req: Request, ctx: RouteContext<"/api/saints/[id]/portrait">) {
  try {
    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > maxUploadBytes() + 1024 * 1024) {
      throw new AppError("imageTooLarge", { status: 413, values: { mb: Math.round(maxUploadBytes() / 1024 / 1024) } });
    }
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      throw new AppError("noFileReceived");
    }
    const file = form.get("file");
    if (!(file instanceof File)) throw new AppError("noFileReceived");
    if (file.size > maxUploadBytes()) {
      throw new AppError("imageTooLarge", { status: 413, values: { mb: Math.round(maxUploadBytes() / 1024 / 1024) } });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const saint = await setSaintPortrait((await ctx.params).id, buf);
    return Response.json({ saint });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/saints/[id]/portrait">) {
  try {
    return Response.json({ saint: removeSaintPortrait((await ctx.params).id) });
  } catch (e) {
    return errorResponse(e);
  }
}
