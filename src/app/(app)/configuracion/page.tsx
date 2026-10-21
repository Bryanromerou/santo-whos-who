import fs from "node:fs";
import type { Metadata } from "next";
import Link from "next/link";
import { FileUp } from "lucide-react";
import { ExportButtons, RestorePanel } from "@/components/settings/data-panel";
import { Button } from "@/components/ui/button";
import { listCollections } from "@/db/repositories/collections";
import { countSaints } from "@/db/repositories/saints";
import { databasePath, maxUploadBytes, portraitsDir, seedFilePath } from "@/lib/config";
import { listPortraitFilesOnDisk } from "@/lib/images/storage";

export const metadata: Metadata = { title: "Configuración" };

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-1 mb-4 text-sm text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
}

export default function ConfiguracionPage() {
  const saints = countSaints();
  const collections = listCollections().length;
  const portraits = listPortraitFilesOnDisk().length;
  // Include SQLite's write-ahead log, which holds recent changes until checkpointed.
  const dbSize = ["", "-wal"].reduce((n, suffix) => {
    const f = databasePath() + suffix;
    return n + (fs.existsSync(f) ? fs.statSync(f).size : 0);
  }, 0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">Todo se guarda en esta computadora. No hay cuentas ni servicios en la nube.</p>
      </div>

      <Card title="Importar biblioteca" description="Carga un archivo JSON de Santos Studio (por ejemplo santos_studio_43_santos.json) con vista previa y validación completa.">
        <Button asChild>
          <Link href={fs.existsSync(seedFilePath()) && saints === 0 ? "/configuracion/importar?seed=1" : "/configuracion/importar"}>
            <FileUp aria-hidden /> Importar JSON
          </Link>
        </Button>
      </Card>

      <Card
        title="Exportar y respaldar"
        description="«Exportar JSON» guarda santos y colecciones en el mismo formato del importador. El respaldo ZIP además incluye los retratos y un manifiesto para restaurar en otra computadora."
      >
        <ExportButtons empty={saints === 0} />
      </Card>

      <Card title="Restaurar respaldo" description="Primero se valida el ZIP completo (sumas de verificación, imágenes y datos). No se cambia nada hasta que confirmes.">
        <RestorePanel />
      </Card>

      <Card title="Datos locales">
        <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Biblioteca</dt>
          <dd>
            {saints} santos · {collections} colecciones · {portraits} retratos
          </dd>
          <dt className="text-muted-foreground">Base de datos</dt>
          <dd className="font-mono text-xs break-all">
            {databasePath()} ({(dbSize / 1024).toFixed(0)} KB)
          </dd>
          <dt className="text-muted-foreground">Retratos</dt>
          <dd className="font-mono text-xs break-all">{portraitsDir()}</dd>
          <dt className="text-muted-foreground">Límite de subida</dt>
          <dd>{Math.round(maxUploadBytes() / 1024 / 1024)} MB por imagen (JPG, PNG o WebP)</dd>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">
          Para cambiar la carpeta de datos, define <code>SANTOS_DATA_DIR</code> en <code>.env.local</code> y reinicia la app.
        </p>
      </Card>
    </div>
  );
}
