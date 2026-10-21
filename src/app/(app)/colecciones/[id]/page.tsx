import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectionEditor } from "@/components/collections/collection-editor";
import { getCollection } from "@/db/repositories/collections";
import { listSaints } from "@/db/repositories/saints";
import { portraitFileExists, portraitUrls } from "@/lib/images/storage";

export async function generateMetadata({ params }: PageProps<"/colecciones/[id]">): Promise<Metadata> {
  return { title: getCollection(decodeURIComponent((await params).id))?.name ?? "Colección" };
}

export default async function CollectionPage({ params }: PageProps<"/colecciones/[id]">) {
  const collection = getCollection(decodeURIComponent((await params).id));
  if (!collection) notFound();
  const saints = listSaints().map((s) => ({
    id: s.id,
    name: s.name,
    country: s.country,
    thumb: portraitFileExists(s.portraitPath) ? portraitUrls(s.portraitPath)!.thumb : null,
  }));
  return <CollectionEditor key={collection.id} collection={collection} saints={saints} />;
}
