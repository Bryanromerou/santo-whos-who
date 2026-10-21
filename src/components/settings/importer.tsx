"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { IMPORT_MODES, type ImportMode } from "@/lib/imports/modes";
import type { ImportReport } from "@/lib/imports/validate";
import { cn } from "@/lib/utils";

type Loaded = { name: string; data: unknown; bytes: number };
type ImportResponse = { summary: string; counts: Record<string, number> };

export function Importer({ seedAvailable, autoSeed, onClose }: { seedAvailable: boolean; autoSeed: boolean; onClose?: () => void }) {
  const router = useRouter();
  const t = useTranslations("import");
  const tc = useTranslations("common");
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
      setParseError(t("invalidJson", { name, message: (e as Error).message }));
    }
  }, [t]);

  const loadSeed = useCallback(async () => {
    try {
      const res = await fetch("/api/import/seed", { cache: "no-store" });
      if (!res.ok) throw new Error(t("seedMissing"));
      loadText("santos_studio_43_santos.json", await res.text());
    } catch (e) {
      setParseError((e as Error).message);
    }
  }, [loadText, t]);

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
      setParseError(t("tooLarge", { mb: 50 }));
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
      toast.success(t("toast.done"), { description: res.summary });
      router.refresh();
    } catch (e) {
      const err = e as ApiError;
      if (err.details && typeof err.details === "object" && "errors" in (err.details as object)) setReport(err.details as ImportReport);
      toast.error(t("toast.failed"), { description: err.message });
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
        <h2 id="step-file" className="text-sm font-semibold">{t("steps.file")}</h2>
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
          <p className="text-sm text-muted-foreground">{t("dropHint")}</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => inputRef.current?.click()}>
              <Upload aria-hidden /> {t("chooseFile")}
            </Button>
            {seedAvailable && (
              <Button variant="secondary" onClick={loadSeed}>
                {t("useSeed")}
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
              {t.rich("loadedFile", { name: loaded.name, kb: Math.round(loaded.bytes / 102.4) / 10, strong: (chunks) => <strong>{chunks}</strong> })}
            </p>
          )}
        </div>
        {parseError && (
          <Alert variant="destructive">
            <XCircle aria-hidden />
            <AlertTitle>{t("cannotRead")}</AlertTitle>
            <AlertDescription>{parseError}</AlertDescription>
          </Alert>
        )}
      </section>

      {/* Step 2: mode */}
      <section aria-labelledby="step-mode" className="space-y-3">
        <h2 id="step-mode" className="text-sm font-semibold">{t("steps.mode")}</h2>
        <RadioGroup value={mode} onValueChange={(v) => setMode(v as ImportMode)} className="gap-2" disabled={!!done}>
          {IMPORT_MODES.map((m) => (
            <Label
              key={m}
              htmlFor={`mode-${m}`}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 font-normal",
                mode === m && "border-primary bg-muted/40",
                m === "replace" && mode === m && "border-destructive bg-destructive/5",
              )}
            >
              <RadioGroupItem id={`mode-${m}`} value={m} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">{t(`modes.${m}.label`)}</span>
                <span className="block text-xs text-muted-foreground">{t(`modes.${m}.help`)}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
      </section>

      {/* Step 3: preview */}
      <section aria-labelledby="step-preview" className="space-y-3" aria-live="polite">
        <h2 id="step-preview" className="flex items-center gap-2 text-sm font-semibold">
          {t("steps.preview")}
          {checking && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label={t("validating")} />}
        </h2>
        {!loaded && !parseError && <p className="text-sm text-muted-foreground">{t("choosePrompt")}</p>}
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
                  {tc("done")}
                </Button>
              ) : (
                <Button size="sm" asChild>
                  <Link href="/santos">{t("viewLibrary")}</Link>
                </Button>
              )}
              <Button size="sm" variant="outline" asChild>
                <Link href="/colecciones">{t("viewCollections")}</Link>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setDone(null); setLoaded(null); setReport(null); }}>
                {t("importAnother")}
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
            {mode === "replace" ? t("replaceButton") : t("importButton")}
          </Button>
          {report && !report.ok && <span className="text-sm text-destructive">{t("fixErrors")}</span>}
          {nothingToDo && <span className="text-sm text-muted-foreground">{t("nothingToDo")}</span>}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("confirm.title")}
        description={
          <>
            <p>{t("confirm.body", { saints: report?.plan.saintsDelete ?? 0, collections: report?.plan.collectionsDelete ?? 0 })}</p>
            <p className="font-medium text-foreground">{t("confirm.warning")}</p>
          </>
        }
        confirmLabel={t("modes.replace.label")}
        destructive
        requireText={t("replaceWord")}
        onConfirm={runImport}
      />
    </div>
  );
}

export function ReportView({ report }: { report: ImportReport }) {
  const t = useTranslations("import.preview");
  const tc = useTranslations("common");
  const pending = report.saintsPreview.filter((s) => s.reviewStatus === "needs_review").length;
  const p = report.plan;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          [t("stats.saints"), report.stats.saints],
          [t("stats.characteristics"), report.stats.characteristics],
          [t("stats.collections"), report.stats.collections],
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
          <AlertTitle>{t("errors", { count: report.errors.length })}</AlertTitle>
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
          <p className="font-medium">{t("onImport")}</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted-foreground">
            {p.saintsDelete > 0 && <li className="text-destructive">{t("plan.delete", { saints: p.saintsDelete, collections: p.collectionsDelete })}</li>}
            <li>{t("plan.saintsCreate", { count: p.saintsCreate })}</li>
            {p.saintsUpdate > 0 && <li>{t("plan.saintsUpdate", { count: p.saintsUpdate })}</li>}
            {p.saintsSkip > 0 && <li>{t("plan.saintsSkip", { count: p.saintsSkip })}</li>}
            <li>
              {t("plan.collectionsCreate", { count: p.collectionsCreate })}
              {p.collectionsUpdate ? t("plan.collectionsUpdate", { count: p.collectionsUpdate }) : ""}
              {p.collectionsSkip ? t("plan.collectionsSkip", { count: p.collectionsSkip }) : ""}
            </li>
            {p.membershipsAdded > 0 && <li>{t("plan.membershipsAdded", { count: p.membershipsAdded, collections: p.collectionsMerge })}</li>}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            {t("reviewNote", { count: pending })}
            {report.source?.factCheckedIndividually === false && ` ${t("notFactChecked")}`}
          </p>
          {typeof report.source?.notes === "string" && <p className="mt-2 text-xs text-muted-foreground italic">{t("fileNote", { note: report.source.notes })}</p>}
        </div>
      )}

      {report.warnings.length > 0 && (
        <Alert className="border-warning/40 bg-warning/10 text-warning-foreground">
          <AlertTriangle aria-hidden />
          <AlertTitle>{t("warnings", { count: report.warnings.length })}</AlertTitle>
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
            {t("showAll", { saints: report.saintsPreview.length, collections: report.collectionsPreview.length })}
          </summary>
          <div className="max-h-96 overflow-auto border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.saint")}</TableHead>
                  <TableHead className="text-right">{t("columns.characteristics")}</TableHead>
                  <TableHead>{t("columns.review")}</TableHead>
                  <TableHead>{t("columns.inLibrary")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.saintsPreview.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-normal">{s.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.characteristics}</TableCell>
                    <TableCell>{s.reviewStatus === "reviewed" ? t("reviewed") : t("pending")}</TableCell>
                    <TableCell>{s.exists ? <Badge variant="outline">{t("exists")}</Badge> : <Badge variant="secondary">{t("new")}</Badge>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="border-t p-4 text-sm">
              <p className="mb-2 font-medium">{t("stats.collections")}</p>
              <ul className="space-y-1">
                {report.collectionsPreview.map((c) => (
                  <li key={c.id} className="flex justify-between gap-4">
                    <span>{c.name}</span>
                    <span className="text-muted-foreground">
                      {tc("saints", { count: c.saints })}
                      {c.exists ? ` · ${t("existsLower")}` : ""}
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
