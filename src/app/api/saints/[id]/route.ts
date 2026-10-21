import { deleteSaint, getSaint, updateSaint } from "@/db/repositories/saints";
import { readJson } from "@/lib/api";
import { errorResponse, notFound } from "@/lib/errors";
import { releasePortraitIfUnused } from "@/lib/images/portrait-service";
import { saintInputSchema } from "@/lib/schema/saint";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/saints/[id]">) {
  try {
    const saint = getSaint((await ctx.params).id);
    if (!saint) throw notFound("El santo");
    return Response.json({ saint });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request, ctx: RouteContext<"/api/saints/[id]">) {
  try {
    const input = await readJson(req, saintInputSchema);
    return Response.json({ saint: updateSaint((await ctx.params).id, input) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/saints/[id]">) {
  try {
    const { portraitPath } = deleteSaint((await ctx.params).id);
    // Only after the delete committed: remove the file unless a duplicate still uses it.
    releasePortraitIfUnused(portraitPath);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
