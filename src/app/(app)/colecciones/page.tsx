import type { Metadata } from "next";
import { CollectionsManager } from "@/components/collections/collections-manager";
import { listCollections } from "@/db/repositories/collections";
import { listSaints } from "@/db/repositories/saints";

export const metadata: Metadata = { title: "Colecciones" };

export default function ColeccionesPage() {
  const names = new Map(listSaints().map((s) => [s.id, s.name]));
  const collections = listCollections().map((c) => ({
    id: c.id,
    name: c.name,
    count: c.saintIds.length,
    preview: c.saintIds.slice(0, 4).map((id) => names.get(id) ?? id),
  }));
  return <CollectionsManager key={collections.map((c) => `${c.id}:${c.name}:${c.count}`).join("|")} collections={collections} />;
}
