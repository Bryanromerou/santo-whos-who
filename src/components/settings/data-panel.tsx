"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, CheckCircle2, FileJson, Loader2, Upload, XCircle } from "lucide-react";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ApiError, api, downloadBlob, filenameFromResponse } from "@/lib/client-api";
import { IMPORT_MODE_LABELS, type ImportMode } from "@/lib/imports/modes";
import type { ImportReport } from "@/lib/imports/validate";
import { cn } from "@/lib/utils";
import { ReportView } from "./importer";

async function download(url: string, fallback: string, label: string) {
  const t = toast.loading(`Preparando ${label}…`);
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || `Error ${res.status}`);
    }
    const blob = await res.blob();
    downloadBlob(blob, filenameFromResponse(res, fallback));
    toast.success("Exportación completada", { id: t, description: `${filenameFromResponse(res, fallback)} · ${(blob.size / 1024).toFixed(0)} KB` });
  } catch (e) {
    toast.error(`No se pudo exportar ${label}`, { id: t, description: (e as Error).message });
  }
}

export function ExportButtons({ empty }: { empty: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={empty} onClick={() => download("/api/export/json", "santos-studio-biblioteca.json", "el JSON")}>
        <FileJson aria-hidden /> Exportar JSON
      </Button>
      <Button disabled={empty} onClick={() => download("/api/backup", "santos-studio-respaldo.zip", "el respaldo")}>
        <Archive aria-hidden /> Descargar respaldo ZIP
      </Button>
    </div>
  );
}

type Preview = { report: ImportReport; portraits: number; manifest?: { createdAt?: string } };
type RestoreResult = { summary: string; portraitsRestored: number };

export function RestorePanel() {
  const router = useRouter();
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
      toast.success("Respaldo restaurado", { description: res.summary });
      router.refresh();
    } catch (e) {
      const err = e as ApiError;
      setError(err.message);
      toast.error("No se restauró nada", { description: err.message });
      throw e;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={!!busy}>
          <Upload aria-hidden /> Elegir respaldo .zip…
        </Button>
        {file && <span className="text-sm">{file.name}</span>}
        {busy === "check" && <Loader2 className="size-4 animate-spin" aria-label="Validando" />}
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
              {IMPORT_MODE_LABELS[m]}
            </Label>
          ))}
        </RadioGroup>
      )}

      {error && (
        <Alert variant="destructive">
          <XCircle aria-hidden />
          <AlertTitle>No se puede restaurar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {preview && !done && (
        <>
          <p className="text-sm text-muted-foreground">
            Respaldo{preview.manifest?.createdAt ? ` del ${new Date(preview.manifest.createdAt).toLocaleString("es")}` : ""} · {preview.portraits} retrato(s)
          </p>
          <ReportView report={preview.report} />
          <Button
            variant={mode === "replace" ? "destructive" : "default"}
            disabled={!preview.report.ok || !!busy}
            onClick={() => (mode === "replace" ? setConfirmOpen(true) : void restore().catch(() => undefined))}
          >
            {busy === "restore" && <Loader2 className="animate-spin" aria-hidden />}
            {mode === "replace" ? "Restaurar y reemplazar biblioteca…" : "Restaurar"}
          </Button>
        </>
      )}
      {done && (
        <Alert className="border-success/40 bg-success/10">
          <CheckCircle2 className="text-success-foreground" aria-hidden />
          <AlertTitle className="text-success-foreground">{done.summary}</AlertTitle>
          <AlertDescription>{done.portraitsRestored} retrato(s) copiados a esta computadora.</AlertDescription>
        </Alert>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Reemplazar la biblioteca con este respaldo?"
        description={
          <>
            <p>Se borrarán los santos y colecciones actuales y se dejarán exactamente los del respaldo.</p>
            <p className="font-medium text-foreground">Si no estás seguro, descarga primero un respaldo de la biblioteca actual.</p>
          </>
        }
        confirmLabel="Reemplazar biblioteca"
        destructive
        requireText="REEMPLAZAR"
        onConfirm={restore}
      />
    </div>
  );
}

