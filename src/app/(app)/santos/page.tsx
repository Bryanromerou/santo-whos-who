import type { Metadata } from "next";
import { SaintLibrary } from "@/components/saints/saint-library";
import { getLibraryView } from "@/lib/library-view";

export const metadata: Metadata = { title: "Biblioteca de Santos" };

export default function SantosPage() {
  const { rows, collections, seedAvailable } = getLibraryView();
  return <SaintLibrary rows={rows} collections={collections} seedAvailable={seedAvailable} />;
}
