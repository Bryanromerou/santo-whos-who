import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SaintLibrary } from "@/components/saints/saint-library";
import { getLibraryView } from "@/lib/library-view";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("library") };
}

export default function SantosPage() {
  const { rows, collections, seedAvailable } = getLibraryView();
  return <SaintLibrary rows={rows} collections={collections} seedAvailable={seedAvailable} />;
}
