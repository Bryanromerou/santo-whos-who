import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SaintEditor } from "@/components/saints/saint-editor";
import { listCollections } from "@/db/repositories/collections";
import { getSaint, listSaints } from "@/db/repositories/saints";
import { FEATURED_CATEGORIES } from "@/lib/categories";
import { maxUploadBytes } from "@/lib/config";
import { portraitUrls } from "@/lib/images/storage";
import { getWorksheetDraft } from "@/lib/worksheet/server";

export async function generateMetadata({ params }: PageProps<"/santos/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (id === "nuevo") return { title: "Nuevo santo" };
  return { title: getSaint(decodeURIComponent(id))?.name ?? "Santo" };
}

export default async function SaintPage({ params }: PageProps<"/santos/[id]">) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const saint = id === "nuevo" ? null : getSaint(id);
  if (id !== "nuevo" && !saint) notFound();

  const suggestions = [...new Set([...FEATURED_CATEGORIES, ...listSaints().flatMap((s) => s.categories)])];
  const collectionNames = saint ? listCollections().filter((c) => c.saintIds.includes(saint.id)).map((c) => c.name) : [];

  return (
    <SaintEditor
      key={saint?.id ?? "nuevo"}
      saint={saint}
      portraitUrl={saint ? portraitUrls(saint.portraitPath)?.master ?? null : null}
      categorySuggestions={suggestions}
      collectionNames={collectionNames}
      worksheetSettings={getWorksheetDraft().settings}
      maxUploadMb={Math.round(maxUploadBytes() / 1024 / 1024)}
    />
  );
}
