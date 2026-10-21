"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
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
export function JsonFormatSummary({ onShowFull }: { onShowFull?: () => void }) {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
      <p className="font-medium">¿Qué archivo necesito?</p>
      <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
        <li>
          Un archivo <code>.json</code> con <code>&quot;format&quot;: &quot;santos-studio-library&quot;</code>, <code>&quot;schemaVersion&quot;: 1</code> y{" "}
          <code>&quot;language&quot;: &quot;es&quot;</code>.
        </li>
        <li>
          Una lista <code>saints</code>: cada santo con un <code>id</code> único, <code>name</code>, fechas, país y sus <code>characteristics</code> (las viñetas).
        </li>
        <li>
          Opcional: <code>collections</code> para agruparlos. Si una colección ya existe, sus santos nuevos se le añaden.
        </li>
        <li>Los santos cuyo id ya está en tu biblioteca se saltan; no se sobrescribe nada a menos que elijas otro modo.</li>
      </ul>
      <div className="flex flex-wrap gap-2 pt-1">
        {onShowFull && (
          <Button size="sm" variant="outline" onClick={onShowFull}>
            Ver formato completo y ejemplo
          </Button>
        )}
        <TemplateButton />
      </div>
    </div>
  );
}

function TemplateButton() {
  return (
    <Button size="sm" variant="ghost" onClick={() => downloadBlob(new Blob([EXAMPLE_JSON + "\n"], { type: "application/json" }), "plantilla-santos-studio.json")}>
      <Download aria-hidden /> Descargar plantilla
    </Button>
  );
}

function FieldTable({ title, fields }: { title: string; fields: FieldDoc[] }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-xs">
          <thead className="bg-muted/40 text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Campo</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Descripción</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {fields.map((f) => (
              <tr key={f.field} className="align-top">
                <td className="px-3 py-2 whitespace-nowrap">
                  <code className="font-mono">{f.field}</code>
                  {!f.required && <span className="ml-1 text-muted-foreground">(opcional)</span>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{f.type}</td>
                <td className="px-3 py-2">{f.description}</td>
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
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-6">
      <FieldTable title="Estructura del archivo" fields={TOP_LEVEL_FIELDS} />
      <FieldTable title="Cada santo (saints[])" fields={SAINT_FIELDS} />
      <FieldTable title="Cada característica (characteristics[])" fields={CHARACTERISTIC_FIELDS} />
      <FieldTable title="Cada colección (collections[])" fields={COLLECTION_FIELDS} />

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Ejemplo completo y válido</h3>
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
                  toast.error("No se pudo copiar; usa «Descargar plantilla».");
                }
              }}
            >
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copiado" : "Copiar ejemplo"}
            </Button>
            <TemplateButton />
          </div>
        </div>
        <pre className="max-h-96 overflow-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed" data-testid="json-example">
          {EXAMPLE_JSON}
        </pre>
        <p className="text-xs text-muted-foreground">
          Consejo: «Exportar JSON» en Configuración genera tu biblioteca actual en este mismo formato; puedes usarla como modelo.
        </p>
      </section>
    </div>
  );
}
