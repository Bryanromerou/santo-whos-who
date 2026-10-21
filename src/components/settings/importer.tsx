"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, FileJson, Loader2, Upload, XCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiError } from "@/lib/client-api";
import type { ImportMode, ImportReport } from "@/lib/imports/validate";
import { pluralize } from "@/lib/text";
import { cn } from "@/lib/utils";

const MODES: { value: ImportMode; label: string; help: string }[] = [
  { value: "skip", label: "Saltar existentes", help: "Agrega los santos y colecciones nuevos, y suma los santos nuevos a las colecciones que ya existen. No modifica ni borra nada de lo que ya tienes. (Recomendado)" },
  { value: "update", label: "Actualizar existentes", help: "Agrega los nuevos y sobrescribe los textos de los que tengan el mismo id. Los retratos que ya subiste se conservan." },
  { value: "replace", label: "Reemplazar biblioteca", help: "Borra TODOS los santos y colecciones actuales y deja solo lo que trae el archivo. Pide confirmación." },
];

type Loaded = { name: string; data: unknown; bytes: number };
type ImportResponse = { summary: string; counts: Record<string, number> };

export function Importer({ seedAvailable, autoSeed, onClose }: { seedAvailable: boolean; autoSeed: boolean; onClose?: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>("skip");
  const [report, setReport] = useState<ImportReport | null>(null);
  const [checking, setChecking] = useState(false);
  const [importing, setImporting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState<ImportResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const loadText = useCallback((name: string, text: string) => {
    setDone(null);
    setReport(null);
    try {
      const data = JSON.parse(text.replace(/^﻿/, ""));
      setLoaded({ name, data, bytes: new Blob([text]).size });
      setParseError(null);
    } catch (e) {
      setLoaded(null);
      setParseError(`«${name}» no es un JSON válido: ${(e as Error).message}`);
    }
  }, []);

  const loadSeed = useCallback(async () => {
    try {
      const res = await fetch("/api/import/seed", { cache: "no-store" });
      if (!res.ok) throw new Error("No se encontró el archivo en seed/.");
      loadText("santos_studio_43_santos.json", await res.text());
    } catch (e) {
      setParseError((e as Error).message);
    }
  }, [loadText]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time load requested via ?seed=1
    if (autoSeed && seedAvailable) void loadSeed();
  }, [autoSeed, seedAvailable, loadSeed]);

  // Dry run whenever the file or mode changes. Nothing is written.
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading flag for the async check below
    setChecking(true);
    api<{ report: ImportReport }>("/api/import", { method: "POST", json: { data: loaded.data, mode, dryRun: true } })
      .then((r) => !cancelled && setReport(r.report))
      .catch((e) => !cancelled && setParseError((e as Error).message))
      .finally(() => !cancelled && setChecking(false));
    return () => {
      cancelled = true;
    };
  }, [loaded, mode]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setParseError("El archivo es demasiado grande (máx. 50 MB).");
      return;
    }
    loadText(file.name, await file.text());
  }

  async function runImport() {
    if (!loaded) return;
    setImporting(true);
    try {
      const res = await api<ImportResponse>("/api/import", {
        method: "POST",
        json: { data: loaded.data, mode, dryRun: false, confirmReplace: mode === "replace" },
      });
      setDone(res);
      toast.success("Importación completada", { description: res.summary });
      router.refresh();
    } catch (e) {
      const err = e as ApiError;
      if (err.details && typeof err.details === "object" && "errors" in (err.details as object)) setReport(err.details as ImportReport);
      toast.error("No se importó nada", { description: err.message });
    } finally {
      setImporting(false);
    }
  }

  const canImport = !!report?.ok && !checking && !importing && !done;
  const nothingToDo = report?.ok && report.plan.saintsCreate + report.plan.saintsUpdate + report.plan.collectionsCreate + report.plan.collectionsUpdate + report.plan.membershipsAdded === 0;

  return (
    <div className="space-y-6">
      {/* Step 1: file */}
      <section aria-labelledby="step-file" className="space-y-3">
        <h2 id="step-file" className="text-sm font-semibold">1. Elige el archivo</h2>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            void onFile(e.dataTransfer.files[0]);
          }}
          className={cn("flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-8 text-center", dragOver && "border-primary bg-muted/50")}
        >
          <FileJson className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Arrastra aquí un archivo .json de Santos Studio</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <Upload aria-hidden /> Elegir archivo…
            </Button>
            {seedAvailable && (
              <Button variant="secondary" onClick={loadSeed}>
                Usar seed/santos_studio_43_santos.json
              </Button>
            )}
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            data-testid="import-file-input"
            onChange={(e) => {
              void onFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {loaded && (
            <p className="text-sm">
              Archivo: <strong>{loaded.name}</strong> ({(loaded.bytes / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>
        {parseError && (
          <Alert variant="destructive">
            <XCircle aria-hidden />
            <AlertTitle>No se puede leer el archivo</AlertTitle>
            <AlertDescription>{parseError}</AlertDescription>
          </Alert>
        )}
      </section>

      {/* Step 2: mode */}
      <section aria-labelledby="step-mode" className="space-y-3">
        <h2 id="step-mode" className="text-sm font-semibold">2. ¿Qué hacer con los registros que ya existen?</h2>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as ImportMode)} className="gap-2" disabled={!!done}>
          {MODES.map((m) => (
            <Label
              key={m.value}
              htmlFor={`mode-${m.value}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal",
                mode === m.value && "border-primary bg-muted/40",
                m.value === "replace" && mode === m.value && "border-destructive bg-destructive/5",
              )}
            >
              <RadioGroupItem id={`mode-${m.value}`} value={m.value} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">{m.label}</span>
                <span className="block text-xs text-muted-foreground">{m.help}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </section>

      {/* Step 3: preview */}
      <section aria-labelledby="step-preview" className="space-y-3" aria-live="polite">
        <h2 id="step-preview" className="flex items-center gap-2 text-sm font-semibold">
          3. Vista previa (no se ha guardado nada todavía)
          {checking && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Validando" />}
        </h2>
        {!loaded && !parseError && <p className="text-sm text-muted-foreground">Elige un archivo para ver la vista previa.</p>}
        {report && <ReportView report={report} />}
      </section>

      {/* Step 4: import */}
      {done ? (
        <Alert className="border-success/40 bg-success/10">
          <CheckCircle2 className="text-success-foreground" aria-hidden />
          <AlertTitle className="text-success-foreground" data-testid="import-summary">
            {done.summary}
          </AlertTitle>
          <AlertDescription>
            <div className="mt-2 flex flex-wrap gap-2">
              {onClose ? (
                <Button size="sm" onClick={onClose}>
                  Listo
                </Button>
              ) : (
                <Button size="sm" asChild>
                  <Link href="/santos">Ver biblioteca</Link>
                </Button>
              )}
              <Button size="sm" variant="outline" asChild>
                <Link href="/colecciones">Ver colecciones</Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setDone(null); setLoaded(null); setReport(null); }}>
                Importar otro archivo
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-wrap items-center gap-3 border-t pt-4">
          <Button
            disabled={!canImport || nothingToDo}
            variant={mode === "replace" ? "destructive" : "default"}
            onClick={() => (mode === "replace" ? setConfirmOpen(true) : runImport())}
          >
            {importing && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {mode === "replace" ? "Reemplazar biblioteca…" : "Importar"}
          </Button>
          {report && !report.ok && <span className="text-sm text-destructive">Corrige los errores del archivo para poder importar.</span>}
          {nothingToDo && <span className="text-sm text-muted-foreground">No hay nada nuevo que importar con este modo.</span>}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Reemplazar toda la biblioteca?"
        description={
          <>
            <p>
              Se eliminarán {report ? pluralize(report.plan.saintsDelete, "santo", "santos") : "los santos"} y{" "}
              {report ? pluralize(report.plan.collectionsDelete, "colección", "colecciones") : "las colecciones"} actuales, junto con sus
              ediciones y retratos que no estén en el archivo.
            </p>
            <p className="font-medium text-foreground">Descarga un respaldo en Configuración antes de continuar si tienes dudas.</p>
          </>
        }
        confirmLabel="Reemplazar biblioteca"
        destructive
        requireText="REEMPLAZAR"
        onConfirm={runImport}
      />
    </div>
  );
}

export function ReportView({ report }: { report: ImportReport }) {
  const pending = report.saintsPreview.filter((s) => s.reviewStatus === "needs_review").length;
  const p = report.plan;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          ["Santos", report.stats.saints],
          ["Características", report.stats.characteristics],
          ["Colecciones", report.stats.collections],
        ].map(([label, n]) => (
          <div key={label} className="rounded-lg border p-3">
            <div className="text-2xl font-semibold tabular-nums">{n}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        ))}
      </div>

      {report.errors.length > 0 && (
        <Alert variant="destructive">
          <XCircle aria-hidden />
          <AlertTitle>{pluralize(report.errors.length, "error", "errores")} — no se importará nada</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 max-h-64 list-disc space-y-1 overflow-auto pl-4">
              {report.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {report.ok && (
        <div className="rounded-lg border p-4 text-sm">
          <p className="font-medium">Al importar:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
            {p.saintsDelete > 0 && <li className="text-destructive">Se eliminarán {pluralize(p.saintsDelete, "santo actual", "santos actuales")} y {pluralize(p.collectionsDelete, "colección", "colecciones")}.</li>}
            <li>{pluralize(p.saintsCreate, "santo nuevo", "santos nuevos")}</li>
            {p.saintsUpdate > 0 && <li>{pluralize(p.saintsUpdate, "santo actualizado", "santos actualizados")}</li>}
            {p.saintsSkip > 0 && <li>{pluralize(p.saintsSkip, "santo ya existe y se saltará", "santos ya existen y se saltarán")}</li>}
            <li>{pluralize(p.collectionsCreate, "colección nueva", "colecciones nuevas")}{p.collectionsUpdate ? `, ${p.collectionsUpdate} actualizada(s)` : ""}{p.collectionsSkip ? `, ${p.collectionsSkip} ya existente(s) sin cambios` : ""}</li>
            {p.membershipsAdded > 0 && (
              <li>
                {pluralize(p.membershipsAdded, "santo se añadirá", "santos se añadirán")} a {pluralize(p.collectionsMerge, "colección existente", "colecciones existentes")} (no se quita a nadie)
              </li>
            )}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Estado de revisión: {pluralize(pending, "santo pendiente", "santos pendientes")} de revisión histórica. Los textos se importan tal cual; no se marcan como verificados.
            {report.source?.factCheckedIndividually === false && " El archivo indica que los datos no fueron verificados individualmente."}
          </p>
          {typeof report.source?.notes === "string" && <p className="mt-2 text-xs text-muted-foreground italic">Nota del archivo: {report.source.notes}</p>}
        </div>
      )}

      {report.warnings.length > 0 && (
        <Alert className="border-warning/40 bg-warning/10 text-warning-foreground">
          <AlertTriangle aria-hidden />
          <AlertTitle>{pluralize(report.warnings.length, "aviso", "avisos")}</AlertTitle>
          <AlertDescription className="text-warning-foreground">
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {report.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {report.saintsPreview.length > 0 && (
        <details className="rounded-lg border">
          <summary className="cursor-pointer px-4 py-2 text-sm font-medium">
            Ver los {report.saintsPreview.length} santos y {report.collectionsPreview.length} colecciones del archivo
          </summary>
          <div className="max-h-96 overflow-auto border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Santo</TableHead>
                  <TableHead className="text-right">Características</TableHead>
                  <TableHead>Revisión</TableHead>
                  <TableHead>En tu biblioteca</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.saintsPreview.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-normal">{s.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.characteristics}</TableCell>
                    <TableCell>{s.reviewStatus === "reviewed" ? "Revisado" : "Pendiente"}</TableCell>
                    <TableCell>{s.exists ? <Badge variant="outline">Ya existe</Badge> : <Badge variant="secondary">Nuevo</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t p-4 text-sm">
              <p className="mb-2 font-medium">Colecciones</p>
              <ul className="space-y-1">
                {report.collectionsPreview.map((c) => (
                  <li key={c.id} className="flex justify-between gap-4">
                    <span>{c.name}</span>
                    <span className="text-muted-foreground">
                      {pluralize(c.saints, "santo", "santos")}
                      {c.exists ? " · ya existe" : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}
