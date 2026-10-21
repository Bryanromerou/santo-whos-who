import fs from "node:fs";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Importer } from "@/components/settings/importer";
import { seedFilePath } from "@/lib/config";

export const metadata: Metadata = { title: "Importar JSON" };

export default async function ImportPage({ searchParams }: PageProps<"/configuracion/importar">) {
  const sp = await searchParams;
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/configuracion" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> Configuración
      </Link>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Importar biblioteca (JSON)</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">
        Formato <code>santos-studio-library</code>, versión 1. Todo el archivo se valida antes de guardar; si hay un error no se importa nada.
      </p>
      <Importer seedAvailable={fs.existsSync(seedFilePath())} autoSeed={sp.seed === "1"} />
    </div>
  );
}
