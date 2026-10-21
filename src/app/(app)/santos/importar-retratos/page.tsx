import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PortraitImporter } from "@/components/saints/portrait-importer";
import { listSaints } from "@/db/repositories/saints";
import { maxUploadBytes } from "@/lib/config";
import { portraitFileExists, portraitUrls } from "@/lib/images/storage";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("importPortraits") };
}

export default async function ImportPortraitsPage() {
  const t = await getTranslations("portraits.page");
  const saints = listSaints().map((s) => ({
    id: s.id,
    name: s.name,
    thumb: portraitFileExists(s.portraitPath) ? portraitUrls(s.portraitPath)!.thumb : null,
  }));
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/santos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> {t("back")}
      </Link>
      <h1 className="font-heading text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-2 mb-8 max-w-3xl text-sm text-muted-foreground">
        {t("description")}
      </p>
      <PortraitImporter saints={saints} maxUploadBytes={maxUploadBytes()} />
    </div>
  );
}
