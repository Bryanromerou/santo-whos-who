import fs from "node:fs";
import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { FileUp } from "lucide-react";
import { ExportButtons, RestorePanel } from "@/components/settings/data-panel";
import { LocaleSelect } from "@/components/settings/locale-select";
import { Button } from "@/components/ui/button";
import { listCollections } from "@/db/repositories/collections";
import { countSaints } from "@/db/repositories/saints";
import { databasePath, maxUploadBytes, portraitsDir, seedFilePath } from "@/lib/config";
import { listPortraitFilesOnDisk } from "@/lib/images/storage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("settings") };
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {description && <p className="mt-1 mb-4 text-sm text-muted-foreground">{description}</p>}
      {children}
    </section>
  );
}

export default async function ConfiguracionPage() {
  const t = await getTranslations("settings");
  const locale = await getLocale();
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
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Card title={t("language.title")} description={t("language.description")}>
        <LocaleSelect value={locale} />
      </Card>

      <Card title={t("import.title")} description={t("import.description")}>
        <Button asChild>
          <Link href={fs.existsSync(seedFilePath()) && saints === 0 ? "/configuracion/importar?seed=1" : "/configuracion/importar"}>
            <FileUp aria-hidden /> {t("import.button")}
          </Link>
        </Button>
      </Card>

      <Card title={t("export.title")} description={t("export.description")}>
        <ExportButtons empty={saints === 0} />
      </Card>

      <Card title={t("restore.title")} description={t("restore.description")}>
        <RestorePanel />
      </Card>

      <Card title={t("data.title")}>
        <dl className="mt-3 grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t("data.library")}</dt>
          <dd>{t("data.counts", { saints, collections, portraits })}</dd>
          <dt className="text-muted-foreground">{t("data.database")}</dt>
          <dd className="font-mono text-xs break-all">
            {databasePath()} ({t("data.kb", { kb: Math.round(dbSize / 1024) })})
          </dd>
          <dt className="text-muted-foreground">{t("data.portraits")}</dt>
          <dd className="font-mono text-xs break-all">{portraitsDir()}</dd>
          <dt className="text-muted-foreground">{t("data.uploadLimit")}</dt>
          <dd>{t("data.uploadLimitValue", { mb: Math.round(maxUploadBytes() / 1024 / 1024) })}</dd>
        </dl>
        <p className="mt-4 text-xs text-muted-foreground">{t.rich("data.changeFolder", { code: (chunks) => <code>{chunks}</code> })}</p>
      </Card>
    </div>
  );
}
