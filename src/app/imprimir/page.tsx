import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PrintReady } from "@/components/worksheets/print-ready";
import { PageRule, WorksheetDocument } from "@/components/worksheets/worksheet-document";
import { buildWorksheet, getWorksheetDraft } from "@/lib/worksheet/server";
import { decodeConfig } from "@/lib/worksheet/settings";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("meta"))("print") };
}

/**
 * Print-only view. Used by «Imprimir» (hidden iframe) and by the PDF exporter
 * (headless Chromium). Renders the exact same WorksheetDocument as the preview.
 */
export default async function ImprimirPage({ searchParams }: PageProps<"/imprimir">) {
  const sp = await searchParams;
  const config = typeof sp.c === "string" ? decodeConfig(sp.c) : getWorksheetDraft();
  const t = await getTranslations("builder.printView");
  if (!config) {
    return <p style={{ padding: 32, fontFamily: "sans-serif" }}>{t("invalidConfig")}</p>;
  }
  const { pages, saints } = buildWorksheet(config);
  return (
    <div className="ws-print-root">
      <PageRule settings={config.settings} />
      {pages.length === 0 ? (
        <p className="no-print" style={{ padding: 32, textAlign: "center" }}>
          {t("empty")}
        </p>
      ) : (
        <WorksheetDocument pages={pages} saints={saints} settings={config.settings} />
      )}
      <PrintReady autoPrint={sp.auto === "1"} />
    </div>
  );
}
