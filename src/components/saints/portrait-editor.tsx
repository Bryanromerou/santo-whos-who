"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ImagePlus, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { portraitImageStyle } from "@/components/worksheets/portrait-frame";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PortraitSettings, SaintRecord } from "@/db/repositories/saints";
import { api } from "@/lib/client-api";

type Props = {
  saintId: string | null;
  portraitUrl: string | null;
  settings: PortraitSettings;
  onSettingsChange: (s: PortraitSettings) => void;
  /** Called with the server's saved record after an upload/removal (these save immediately). */
  onSaved: (saint: SaintRecord) => void;
  maxUploadMb: number;
};

const ACCEPT = "image/jpeg,image/png,image/webp";

export function PortraitEditor({ saintId, portraitUrl, settings, onSettingsChange, onSaved, maxUploadMb }: Props) {
  const t = useTranslations("portraits.editor");
  const inputRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [broken, setBroken] = useState<string | null>(null);

  async function upload(file: File | undefined) {
    if (!file || !saintId) return;
    if (!ACCEPT.split(",").includes(file.type) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
      toast.error(t("unsupportedTitle"), { description: t("unsupportedBody") });
      return;
    }
    if (file.size > maxUploadMb * 1024 * 1024) {
      toast.error(t("tooLargeTitle"), { description: t("tooLargeBody", { mb: maxUploadMb }) });
      return;
    }
    setBusy("upload");
    try {
      const body = new FormData();
      body.append("file", file);
      const { saint } = await api<{ saint: SaintRecord }>(`/api/saints/${encodeURIComponent(saintId)}/portrait`, { method: "POST", body });
      setBroken(null);
      onSaved(saint);
      toast.success(portraitUrl ? t("replaced") : t("uploaded"));
    } catch (e) {
      toast.error(t("uploadFailed"), { description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (!saintId) return;
    setBusy("remove");
    try {
      const { saint } = await api<{ saint: SaintRecord }>(`/api/saints/${encodeURIComponent(saintId)}/portrait`, { method: "DELETE" });
      onSaved(saint);
      toast.success(t("removed"));
    } catch (e) {
      toast.error(t("removeFailed"), { description: (e as Error).message });
      throw e;
    } finally {
      setBusy(null);
    }
  }

  // Drag inside the frame to move the focal point (pan the crop).
  const onPointerDown = (e: React.PointerEvent) => {
    if (!portraitUrl) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, fx: settings.focalX, fy: settings.focalY };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const box = frameRef.current?.getBoundingClientRect();
    if (!d || !box) return;
    const k = 100 / settings.zoom;
    const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)));
    onSettingsChange({
      ...settings,
      focalX: clamp(d.fx - ((e.clientX - d.x) / box.width) * k),
      focalY: clamp(d.fy - ((e.clientY - d.y) / box.height) * k),
    });
  };
  const endDrag = () => (drag.current = null);

  const showImage = portraitUrl && broken !== portraitUrl;

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <div
          ref={frameRef}
          className="relative aspect-[3/4] w-36 shrink-0 touch-none overflow-hidden rounded-sm border bg-white select-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          style={{ cursor: showImage ? "grab" : undefined }}
          aria-label={showImage ? t("dragToMove") : undefined}
        >
          {showImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- local portrait route
            <img
              src={portraitUrl}
              alt={t("currentAlt")}
              draggable={false}
              className="absolute inset-0 h-full w-full"
              style={portraitImageStyle({ ...settings, src: portraitUrl })}
              onError={() => setBroken(portraitUrl)}
            />
          ) : (
            <div className="grid h-full place-items-center border-dashed p-2 text-center text-xs text-muted-foreground">
              {portraitUrl ? t("fileMissing") : t("placeholder")}
            </div>
          )}
          {busy && (
            <div className="absolute inset-0 grid place-items-center bg-white/70">
              <Loader2 className="size-5 animate-spin" aria-label={t("processing")} />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          {!saintId ? (
            <p className="text-sm text-muted-foreground">{t("saveFirst")}</p>
          ) : (
            <>
              <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={() => inputRef.current?.click()}>
                {portraitUrl ? <RefreshCw aria-hidden /> : <ImagePlus aria-hidden />}
                {portraitUrl ? t("replace") : t("upload")}
              </Button>
              {portraitUrl && (
                <Button type="button" variant="ghost" size="sm" disabled={!!busy} onClick={() => setConfirmRemove(true)} className="text-destructive">
                  <Trash2 aria-hidden /> {t("remove")}
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                {t("help", { mb: maxUploadMb })}
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            data-testid="portrait-input"
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {showImage && (
        <fieldset className="space-y-3 rounded-lg border p-3">
          <legend className="px-1 text-xs font-medium text-muted-foreground">{t("framing")}</legend>
          <Tabs value={settings.fit} onValueChange={(v) => onSettingsChange({ ...settings, fit: v as PortraitSettings["fit"] })}>
            <TabsList className="w-full">
              <TabsTrigger value="cover" className="flex-1">{t("cover")}</TabsTrigger>
              <TabsTrigger value="contain" className="flex-1">{t("contain")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <CropSlider id="zoom" label={t("zoom")} value={settings.zoom} min={1} max={3} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(zoom) => onSettingsChange({ ...settings, zoom })} />
          <CropSlider id="focal-x" label={t("horizontal")} value={settings.focalX} min={0} max={100} step={1} format={(v) => `${v}%`} onChange={(focalX) => onSettingsChange({ ...settings, focalX })} />
          <CropSlider id="focal-y" label={t("vertical")} value={settings.focalY} min={0} max={100} step={1} format={(v) => `${v}%`} onChange={(focalY) => onSettingsChange({ ...settings, focalY })} />
          <Button type="button" variant="ghost" size="xs" onClick={() => onSettingsChange({ focalX: 50, focalY: 50, zoom: 1, fit: "cover" })}>
            {t("resetFraming")}
          </Button>
        </fieldset>
      )}

      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={t("removeTitle")}
        description={<p>{t("removeBody")}</p>}
        confirmLabel={t("remove")}
        destructive
        onConfirm={remove}
      />
    </div>
  );
}

function CropSlider(props: { id: string; label: string; value: number; min: number; max: number; step: number; format: (v: number) => string; onChange: (v: number) => void }) {
  const id = `crop-${props.id}`;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <Label htmlFor={id} className="text-xs font-normal">
          {props.label}
        </Label>
        <span className="tabular-nums text-muted-foreground">{props.format(props.value)}</span>
      </div>
      <Slider id={id} value={[props.value]} min={props.min} max={props.max} step={props.step} onValueChange={([v]) => props.onChange(v)} aria-label={props.label} />
    </div>
  );
}
