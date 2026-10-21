import { z } from "zod";
import { addToCollection, deleteCollection, getCollection, updateCollection } from "@/db/repositories/collections";
import { readJson } from "@/lib/api";
import { errorResponse, notFound } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/collections/[id]">) {
  try {
    const c = getCollection((await ctx.params).id);
    if (!c) throw notFound("collection");
    return Response.json({ collection: c });
  } catch (e) {
    return errorResponse(e);
  }
}

const patchSchema = z.object({
  name: z.string().max(200).optional(),
  saintIds: z.array(z.string()).optional(),
  addSaintIds: z.array(z.string()).optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<"/api/collections/[id]">) {
  try {
    const { id } = await ctx.params;
    const body = await readJson(req, patchSchema);
    let collection = body.addSaintIds ? addToCollection(id, body.addSaintIds) : getCollection(id);
    if (body.name !== undefined || body.saintIds) collection = updateCollection(id, { name: body.name, saintIds: body.saintIds });
    if (!collection) throw notFound("collection");
    return Response.json({ collection });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/collections/[id]">) {
  try {
    deleteCollection((await ctx.params).id);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
