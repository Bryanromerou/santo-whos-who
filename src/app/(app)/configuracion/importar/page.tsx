import fs from "node:fs";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Importer } from "@/components/settings/importer";
import { JsonFormatReference } from "@/components/settings/json-format-help";
import { seedFilePath } from "@/lib/config";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("importJson") };
}

export default async function ImportPage({ searchParams }: PageProps<"/configuracion/importar">) {
  const sp = await searchParams;
  const t = await getTranslations("import.page");
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/configuracion" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> {t("back")}
      </Link>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">
        {t.rich("description", { code: (chunks) => <code>{chunks}</code> })}
      </p>
      <Importer seedAvailable={fs.existsSync(seedFilePath())} autoSeed={sp.seed === "1"} />
      <details className="mt-10 rounded-lg border p-4">
        <summary className="cursor-pointer text-sm font-semibold">{t("formatDetails")}</summary>
        <div className="pt-4">
          <JsonFormatReference />
        </div>
      </details>
    </div>
  );
}
