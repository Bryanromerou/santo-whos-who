"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loose } from "@/i18n/loose";
import { downloadBlob } from "@/lib/client-api";
import {
  CHARACTERISTIC_FIELDS,
  COLLECTION_FIELDS,
  EXAMPLE_JSON,
  SAINT_FIELDS,
  TOP_LEVEL_FIELDS,
  type FieldDoc,
} from "@/lib/imports/example";

/** Short summary shown next to the upload area. */
const code = (chunks: React.ReactNode) => <code>{chunks}</code>;

export function JsonFormatSummary({ onShowFull }: { onShowFull?: () => void }) {
  const t = useTranslations("import.format.summary");
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="font-medium">{t("title")}</p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        <li>{t.rich("file", { code })}</li>
        <li>{t.rich("saints", { code })}</li>
        <li>{t.rich("collections", { code })}</li>
        <li>{t("existing")}</li>
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        {onShowFull && (
          <Button size="sm" variant="outline" onClick={onShowFull}>
            {t("showFull")}
          </Button>
        )}
        <TemplateButton />
      </div>
    </div>
  );
}

function TemplateButton() {
  const t = useTranslations("import.format");
  return (
    <Button size="sm" variant="ghost" onClick={() => downloadBlob(new Blob([EXAMPLE_JSON + "\n"], { type: "application/json" }), "plantilla-santos-studio.json")}>
      <Download aria-hidden /> {t("downloadTemplate")}
    </Button>
  );
}

function FieldTable({ title, group, fields }: { title: string; group: "top" | "saint" | "characteristic" | "collection"; fields: FieldDoc[] }) {
  const t = useTranslations("import.format");
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{t("columns.field")}</th>
              <th className="px-3 py-2 font-medium">{t("columns.type")}</th>
              <th className="px-3 py-2 font-medium">{t("columns.description")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {fields.map((f) => (
              <tr key={f.field} className="align-top">
                <td className="px-3 py-2 whitespace-nowrap">
                  <code className="font-mono">{f.field}</code>
                  {!f.required && <span className="ml-1 text-muted-foreground">{t("optional")}</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{t(`types.${f.type}`)}</td>
                <td className="px-3 py-2">{loose(t)(`fields.${group}.${f.field}`)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Full reference: field tables plus a copyable, valid example. */
export function JsonFormatReference() {
  const t = useTranslations("import.format");
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-6">
      <FieldTable title={t("tables.top")} group="top" fields={TOP_LEVEL_FIELDS} />
      <FieldTable title={t("tables.saint")} group="saint" fields={SAINT_FIELDS} />
      <FieldTable title={t("tables.characteristic")} group="characteristic" fields={CHARACTERISTIC_FIELDS} />
      <FieldTable title={t("tables.collection")} group="collection" fields={COLLECTION_FIELDS} />

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{t("exampleTitle")}</h3>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(EXAMPLE_JSON);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  toast.error(t("copyFailed"));
                }
              }}
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? t("copied") : t("copyExample")}
            </Button>
            <TemplateButton />
          </div>
        </div>
        <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed" data-testid="json-example">
          {EXAMPLE_JSON}
        </pre>
        <p className="text-xs text-muted-foreground">{t("tip")}</p>
      </section>
    </div>
  );
}
