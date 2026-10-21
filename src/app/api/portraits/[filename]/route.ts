import fs from "node:fs/promises";
import { resolveServeFile } from "@/lib/images/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Serves processed portrait files. Only `<uuid>.jpg` / `<uuid>.thumb.jpg`
 * names are accepted; anything else (paths, traversal, other extensions) is 404.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/portraits/[filename]">) {
  const { filename } = await ctx.params;
  const full = resolveServeFile(filename);
  if (!full) return new Response("No encontrado", { status: 404 });
  try {
    const data = await fs.readFile(full);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(data.length),
        // UUID names never change content, so they can be cached forever.
        "Cache-Control": "private, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("No encontrado", { status: 404 });
  }
}
