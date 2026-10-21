import { z } from "zod";
import { createCollection, listCollections, reorderCollections } from "@/db/repositories/collections";
import { readJson } from "@/lib/api";
import { errorResponse } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json({ collections: listCollections() });
  } catch (e) {
    return errorResponse(e);
  }
}

const createSchema = z.object({ name: z.string().trim().min(1, { error: "El nombre es obligatorio" }).max(200), saintIds: z.array(z.string()).default([]) });

export async function POST(req: Request) {
  try {
    const { name, saintIds } = await readJson(req, createSchema);
    return Response.json({ collection: createCollection(name, saintIds) }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Reorders the collection list. */
export async function PATCH(req: Request) {
  try {
    const { order } = await readJson(req, z.object({ order: z.array(z.string()) }));
    reorderCollections(order);
    return Response.json({ collections: listCollections() });
  } catch (e) {
    return errorResponse(e);
  }
}
