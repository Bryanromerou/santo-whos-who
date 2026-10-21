import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PortraitImporter } from "@/components/saints/portrait-importer";
import { listSaints } from "@/db/repositories/saints";
import { maxUploadBytes } from "@/lib/config";
import { portraitFileExists, portraitUrls } from "@/lib/images/storage";

export const metadata: Metadata = { title: "Importar retratos" };

export default function ImportPortraitsPage() {
  const saints = listSaints().map((s) => ({
    id: s.id,
    name: s.name,
    thumb: portraitFileExists(s.portraitPath) ? portraitUrls(s.portraitPath)!.thumb : null,
  }));
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/santos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Biblioteca
      </Link>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Importar retratos</h1>
      <p className="mt-2 mb-8 max-w-3xl text-sm text-muted-foreground">
        Elige una carpeta o varias imágenes. Cada archivo se asigna al santo con el mismo nombre (sin importar acentos ni mayúsculas).
        Los nombres parecidos y las imágenes repetidas se revisan antes de importar.
      </p>
      <PortraitImporter saints={saints} maxUploadBytes={maxUploadBytes()} />
    </div>
  );
}
