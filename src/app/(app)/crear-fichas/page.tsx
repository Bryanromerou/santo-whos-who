import type { Metadata } from "next";
import { WorksheetBuilder } from "@/components/worksheets/worksheet-builder";
import { listCollections } from "@/db/repositories/collections";
import { listSaints } from "@/db/repositories/saints";
import { getWorksheetDraft, worksheetSaintMap } from "@/lib/worksheet/server";

export const metadata: Metadata = { title: "Crear Fichas" };

export default async function CrearFichasPage({ searchParams }: PageProps<"/crear-fichas">) {
  const sp = await searchParams;
  const saints = listSaints();
  const known = new Set(saints.map((s) => s.id));
  const collections = listCollections();
  const draft = getWorksheetDraft();

  // ?ids=a,b,c (from the library) or ?coleccion=<id> replace the current selection.
  let fromUrl = false;
  let saintIds = draft.saintIds;
  if (typeof sp.ids === "string" && sp.ids) {
    saintIds = sp.ids.split(",").map((s) => decodeURIComponent(s)).filter((id) => known.has(id));
    fromUrl = true;
  } else if (typeof sp.coleccion === "string") {
    const c = collections.find((x) => x.id === sp.coleccion);
    if (c) {
      saintIds = c.saintIds;
      fromUrl = true;
    }
  }
  saintIds = [...new Set(saintIds.filter((id) => known.has(id)))];

  const picker = Object.fromEntries(
    saints.map((s) => [
      s.id,
      { id: s.id, name: s.name, country: s.country, birthYear: s.birthYear, searchText: [s.name, s.country, ...s.patronages].join(" ") },
    ]),
  );

  return (
    <WorksheetBuilder
      cards={worksheetSaintMap(saints)}
      picker={picker}
      allIds={saints.map((s) => s.id)}
      collections={collections.map((c) => ({ id: c.id, name: c.name, saintIds: c.saintIds }))}
      initialConfig={{ ...draft, saintIds, soloSaintIds: fromUrl ? [] : draft.soloSaintIds.filter((id) => saintIds.includes(id)) }}
      fromUrl={fromUrl}
    />
  );
}
