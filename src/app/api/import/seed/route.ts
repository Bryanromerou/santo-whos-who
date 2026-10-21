import fs from "node:fs/promises";
import { seedFilePath } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Returns seed/santos_studio_43_santos.json as-is (text), if present. */
export async function GET() {
  try {
    const text = await fs.readFile(seedFilePath(), "utf8");
    return new Response(text, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "No existe seed/santos_studio_43_santos.json." }, { status: 404 });
  }
}
