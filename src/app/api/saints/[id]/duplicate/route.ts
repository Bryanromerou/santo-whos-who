import { duplicateSaint } from "@/db/repositories/saints";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: RouteContext<"/api/saints/[id]/duplicate">) {
  try {
    return Response.json({ saint: duplicateSaint((await ctx.params).id) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
