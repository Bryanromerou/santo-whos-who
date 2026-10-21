"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Archive, CheckCircle2, FileJson, Loader2, Upload, XCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ApiError, api, downloadBlob, filenameFromResponse } from "@/lib/client-api";
import type { ImportMode } from "@/lib/imports/modes";
import type { ImportReport } from "@/lib/imports/validate";
import { cn } from "@/lib/utils";
import { ReportView } from "./importer";

type BackupT = ReturnType<typeof useTranslations<"backup">>;

async function download(url: string, fallback: string, what: "json" | "zip", t: BackupT) {
  const toastId = toast.loading(t(`export.preparing.${what}`));
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || `Error ${res.status}`);
    }
    const blob = await res.blob();
    downloadBlob(blob, filenameFromResponse(res, fallback));
    toast.success(t("export.done"), { id: toastId, description: t("export.doneDetail", { file: filenameFromResponse(res, fallback), kb: Math.round(blob.size / 1024) }) });
  } catch (e) {
    toast.error(t(`export.failed.${what}`), { id: toastId, description: (e as Error).message });
  }
}

export function ExportButtons({ empty }: { empty: boolean }) {
  const t = useTranslations("backup");
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={empty} onClick={() => download("/api/export/json", "santos-studio-biblioteca.json", "json", t)}>
        <FileJson aria-hidden /> {t("export.json")}
      </Button>
      <Button disabled={empty} onClick={() => download("/api/backup", "santos-studio-respaldo.zip", "zip", t)}>
        <Archive aria-hidden /> {t("export.zip")}
      </Button>
    </div>
  );
}

type Preview = { report: ImportReport; portraits: number; manifest?: { createdAt?: string } };
type RestoreResult = { summary: string; portraitsRestored: number };

export function RestorePanel() {
  const router = useRouter();
  const t = useTranslations("backup.restore");
  const ti = useTranslations("import");
  const locale = useLocale();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<ImportMode>("replace");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<"check" | "restore" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState<RestoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function check(f: File, m: ImportMode) {
    setBusy("check");
    setError(null);
    setDone(null);
    try {
      const body = new FormData();
      body.append("file", f);
      body.append("mode", m);
      body.append("dryRun", "true");
      setPreview(await api<Preview>("/api/backup/restore", { method: "POST", body }));
    } catch (e) {
      setPreview(null);
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    if (!file) return;
    setBusy("restore");
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("mode", mode);
      body.append("dryRun", "false");
      body.append("confirmReplace", mode === "replace" ? "true" : "false");
      const res = await api<RestoreResult>("/api/backup/restore", { method: "POST", body });
      setDone(res);
      toast.success(t("done"), { description: res.summary });
      router.refresh();
    } catch (e) {
      const err = e as ApiError;
      setError(err.message);
      toast.error(t("failed"), { description: err.message });
      throw e;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={!!busy}>
          <Upload aria-hidden /> {t("choose")}
        </Button>
        {file && <span className="text-sm">{file.name}</span>}
        {busy === "check" && <Loader2 className="size-4 animate-spin" aria-label={ti("validating")} />}
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          className="sr-only"
          data-testid="restore-input"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setFile(f);
            void check(f, mode);
          }}
        />
      </div>

      {file && (
        <RadioGroup
          value={mode}
          onValueChange={(v) => {
            setMode(v as ImportMode);
            void check(file, v as ImportMode);
          }}
          className="flex flex-wrap gap-2"
          disabled={!!done}
        >
          {(["replace", "skip", "update"] as const).map((m) => (
            <Label key={m} htmlFor={`restore-${m}`} className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 font-normal", mode === m && "border-primary bg-muted/40")}>
              <RadioGroupItem id={`restore-${m}`} value={m} />
              {ti(`modes.${m}.label`)}
            </Label>
          ))}
        </RadioGroup>
      )}

      {error && (
        <Alert variant="destructive">
          <XCircle aria-hidden />
          <AlertTitle>{t("cannotRestore")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {preview && !done && (
        <>
          <p className="text-sm text-muted-foreground">
            {preview.manifest?.createdAt ? t("summaryDated", { date: new Date(preview.manifest.createdAt).toLocaleString(locale) }) : t("summary")} ·{" "}
            {t("portraits", { count: preview.portraits })}
          </p>
          <ReportView report={preview.report} />
          <Button
            variant={mode === "replace" ? "destructive" : "default"}
            disabled={!preview.report.ok || !!busy}
            onClick={() => (mode === "replace" ? setConfirmOpen(true) : void restore().catch(() => undefined))}
          >
            {busy === "restore" && <Loader2 className="animate-spin" aria-hidden />}
            {mode === "replace" ? t("restoreReplace") : t("restore")}
          </Button>
        </>
      )}
      {done && (
        <Alert className="border-success/40 bg-success/10">
          <CheckCircle2 className="text-success-foreground" aria-hidden />
          <AlertTitle className="text-success-foreground">{done.summary}</AlertTitle>
          <AlertDescription>{t("portraitsCopied", { count: done.portraitsRestored })}</AlertDescription>
        </Alert>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("confirmTitle")}
        description={
          <>
            <p>{t("confirmBody")}</p>
            <p className="font-medium text-foreground">{t("confirmWarning")}</p>
          </>
        }
        confirmLabel={ti("modes.replace.label")}
        destructive
        requireText={ti("replaceWord")}
        onConfirm={restore}
      />
    </div>
  );
}

