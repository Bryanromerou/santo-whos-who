"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, ExternalLink, ListChecks, Loader2, Maximize, Minus, Plus, Printer, SlidersHorizontal, Wand2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { api, ApiError, downloadBlob, filenameFromResponse } from "@/lib/client-api";
import type { WorksheetSaint } from "@/lib/worksheet/card-data";
import { paginate } from "@/lib/worksheet/paginate";
import { encodeConfig, LIMITS, PAPER_SIZES, type WorksheetConfig, type WorksheetSettings } from "@/lib/worksheet/settings";
import { SelectionPanel, SettingsPanel, type PickerCollection, type PickerSaint } from "./builder-panels";
import { findOverflowingCards, waitForAssets } from "./measure";
import { WorksheetDocument } from "./worksheet-document";

const PX_PER_IN = 96;
const PAGE_GAP_PX = 24;

type Props = {
  cards: Record<string, WorksheetSaint>;
  picker: Record<string, PickerSaint>;
  allIds: string[];
  collections: PickerCollection[];
  initialConfig: WorksheetConfig;
  /** True when the URL asked for a new selection (library/collection) that must be saved. */
  fromUrl: boolean;
};

export function WorksheetBuilder({ cards, picker, allIds, collections, initialConfig, fromUrl }: Props) {
  const router = useRouter();
  const t = useTranslations("builder");
  const tc = useTranslations("common");
  const [config, setConfig] = useState<WorksheetConfig>(initialConfig);
  const [overflowIds, setOverflowIds] = useState<Set<string>>(new Set());
  const [measuring, setMeasuring] = useState(true);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [fitScale, setFitScale] = useState(0.6);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [printBusy, setPrintBusy] = useState(false);
  const [autoFit, setAutoFit] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const previewRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRender = useRef(true);

  const { settings, saintIds, soloSaintIds } = config;
  const ids = useMemo(() => saintIds.filter((id) => cards[id]), [saintIds, cards]);
  const pages = useMemo(() => paginate(ids, settings.perPage, soloSaintIds), [ids, settings.perPage, soloSaintIds]);
  const paper = PAPER_SIZES[settings.paperSize];
  const pageW = paper.widthIn * PX_PER_IN;
  const pageH = paper.heightIn * PX_PER_IN;
  const scale = zoom === "fit" ? fitScale : zoom;

  /* ---------- persistence (debounced) ---------- */
  const persist = useCallback(async (c: WorksheetConfig) => {
    setSaveState("saving");
    try {
      await api("/api/worksheet", { method: "PUT", json: c });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, []);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      if (fromUrl) {
        // Selection came from the library/collection link: store it right away.
        void api("/api/worksheet", { method: "PUT", json: config }).catch(() => setSaveState("error"));
        router.replace("/crear-fichas", { scroll: false });
      }
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persist(config), 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [config, fromUrl, persist, router]);

  const flushSave = async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    await persist(config);
  };

  /* ---------- fit-to-width zoom ---------- */
  useLayoutEffect(() => {
    const el = centerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setFitScale(Math.max(0.25, Math.min(1.25, (el.clientWidth - 48) / pageW))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageW]);

  /* ---------- overflow measurement on every layout change ---------- */
  useEffect(() => {
    const root = previewRef.current;
    if (!root) return;
    let cancelled = false;
    setMeasuring(true);
    void waitForAssets(root).then(() => {
      if (cancelled) return;
      requestAnimationFrame(() => {
        if (cancelled) return;
        setOverflowIds(new Set(findOverflowingCards(root)));
        setMeasuring(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [pages, settings, cards]);

  const overflowList = useMemo(() => ids.filter((id) => overflowIds.has(id)), [ids, overflowIds]);

  /* ---------- automatic fit: shrink spacing, then font, until everything fits ---------- */
  useEffect(() => {
    if (!autoFit || measuring) return;
    if (overflowList.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- finishing the auto-fit loop
      setAutoFit(false);
      toast.success(t("toast.allFits"), { description: t("toast.allFitsDetail", { font: settings.fontSizePt, spacing: settings.bulletSpacingPt }) });
      return;
    }
    const s = settings;
    if (s.bulletSpacingPt > 1) setConfig((c) => ({ ...c, settings: { ...c.settings, bulletSpacingPt: Math.max(1, c.settings.bulletSpacingPt - 1) } }));
    else if (s.fontSizePt > 8.5) setConfig((c) => ({ ...c, settings: { ...c.settings, fontSizePt: c.settings.fontSizePt - 0.5 } }));
    else {
      setAutoFit(false);
      toast.warning(t("toast.shrinkNotEnough"), { description: t("toast.shrinkNotEnoughDetail") });
    }
  }, [autoFit, measuring, overflowList, settings, t]);

  const updateSettings = (s: WorksheetSettings) => setConfig((c) => ({ ...c, settings: s }));
  const setIds = (next: string[]) => setConfig((c) => ({ ...c, saintIds: next, soloSaintIds: c.soloSaintIds.filter((id) => next.includes(id)) }));
  const toggleSolo = (id: string) =>
    setConfig((c) => ({ ...c, soloSaintIds: c.soloSaintIds.includes(id) ? c.soloSaintIds.filter((x) => x !== id) : [...c.soloSaintIds, id] }));

  const reduceOnce = () =>
    setConfig((c) => ({
      ...c,
      settings: {
        ...c.settings,
        fontSizePt: Math.max(LIMITS.fontSizePt.min, c.settings.fontSizePt - 0.5),
        bulletSpacingPt: Math.max(0, c.settings.bulletSpacingPt - 1),
      },
    }));
  const soloForOverflowing = () => setConfig((c) => ({ ...c, soloSaintIds: [...new Set([...c.soloSaintIds, ...overflowList])] }));

  const blocked = ids.length === 0 || measuring || overflowList.length > 0;

  /* ---------- print (same view as PDF, via hidden iframe) ---------- */
  async function print() {
    if (blocked) return;
    setPrintBusy(true);
    await flushSave();
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      setPrintBusy(false);
      setTimeout(() => iframe.remove(), 1000);
    };
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow || e.data?.type !== "santos-print") return;
      if (e.data.status === "overflow") {
        toast.error(t("toast.printBlocked"), { description: t("toast.printBlockedDetail") });
        cleanup();
      } else if (e.data.status === "done") cleanup();
    };
    window.addEventListener("message", onMessage);
    iframe.src = `/imprimir?auto=1&c=${encodeConfig(config)}`;
    document.body.appendChild(iframe);
    setTimeout(() => setPrintBusy(false), 15_000);
  }

  /* ---------- PDF ---------- */
  async function downloadPdf() {
    if (blocked) return;
    setPdfBusy(true);
    const toastId = toast.loading(t("toast.generatingPdf"), { description: tc("pages", { count: pages.length }) });
    try {
      await flushSave();
      const res = await fetch("/api/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const over: string[] = data?.details?.overflow ?? [];
        if (over.length) setOverflowIds(new Set(over));
        throw new ApiError(data?.error || `Error ${res.status}`, res.status);
      }
      const blob = await res.blob();
      downloadBlob(blob, filenameFromResponse(res, "fichas-santos.pdf"));
      toast.success(t("toast.pdfDownloaded"), { id: toastId, description: `${tc("pages", { count: pages.length })} · ${tc("saints", { count: ids.length })}` });
    } catch (e) {
      toast.error(t("toast.pdfFailed"), { id: toastId, description: (e as Error).message });
    } finally {
      setPdfBusy(false);
    }
  }

  const selection = (
    <SelectionPanel
      saints={picker}
      allIds={allIds}
      collections={collections}
      selected={ids}
      soloIds={soloSaintIds}
      overflowIds={overflowIds}
      perPage={settings.perPage}
      onChange={setIds}
      onToggleSolo={toggleSolo}
    />
  );
  const settingsPanel = <SettingsPanel settings={settings} onChange={updateSettings} />;
  const totalH = pages.length * (pageH + PAGE_GAP_PX) - PAGE_GAP_PX;

  return (
    <div className="grid h-[calc(100vh-3.5rem)] grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
      <aside className="hidden min-h-0 border-r xl:block" aria-label={t("selection.aria")}>
        {selection}
      </aside>

      <section className="flex min-h-0 flex-col bg-muted/40" aria-label={t("previewAria")}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b bg-background px-4 py-2">
          <div className="flex gap-2 xl:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <ListChecks aria-hidden /> {t("saintsButton", { count: ids.length })}
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[340px] p-0 sm:max-w-[340px]">
                <SheetHeader className="sr-only">
                  <SheetTitle>{t("selection.title")}</SheetTitle>
                  <SheetDescription>{t("selection.sheetDescription")}</SheetDescription>
                </SheetHeader>
                {selection}
              </SheetContent>
            </Sheet>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <SlidersHorizontal aria-hidden /> {t("settingsButton")}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[320px] overflow-y-auto p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>{t("settings.title")}</SheetTitle>
                  <SheetDescription>{t("settings.sheetDescription")}</SheetDescription>
                </SheetHeader>
                {settingsPanel}
              </SheetContent>
            </Sheet>
          </div>
          <div className="text-sm" data-testid="page-count" aria-live="polite">
            <strong>{tc("pages", { count: pages.length })}</strong>
            <span className="text-muted-foreground">
              {" "}
              · {t("cards", { count: ids.length })} · {t(`paper.${settings.paperSize}Short`)}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1" role="group" aria-label={t("zoom")}>
            <Button variant="ghost" size="icon-sm" onClick={() => setZoom(Math.max(0.25, +(scale - 0.1).toFixed(2)))} aria-label={t("zoomOut")}>
              <Minus aria-hidden />
            </Button>
            <span className="w-12 text-center text-xs tabular-nums">{Math.round(scale * 100)}%</span>
            <Button variant="ghost" size="icon-sm" onClick={() => setZoom(Math.min(2, +(scale + 0.1).toFixed(2)))} aria-label={t("zoomIn")}>
              <Plus aria-hidden />
            </Button>
            <Button variant={zoom === "fit" ? "secondary" : "ghost"} size="sm" onClick={() => setZoom("fit")}>
              <Maximize aria-hidden /> {t("fit")}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={print} disabled={blocked || printBusy}>
              {printBusy ? <Loader2 className="animate-spin" aria-hidden /> : <Printer aria-hidden />} {t("print")}
            </Button>
            <Button size="sm" onClick={downloadPdf} disabled={blocked || pdfBusy}>
              {pdfBusy ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />} {t("downloadPdf")}
            </Button>
          </div>
        </div>

        {/* Status / overflow warnings */}
        <div className="space-y-2 px-4 pt-3" aria-live="polite">
          {ids.length > 0 && overflowList.length > 0 && !measuring && (
            <Alert variant="destructive" data-testid="overflow-warning">
              <AlertTriangle aria-hidden />
              <AlertTitle>
                {t("overflow.title", { count: overflowList.length })}
              </AlertTitle>
              <AlertDescription>
                <p>
                  {t("overflow.body", { names: overflowList.map((id) => cards[id]?.name).join(", ") })}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={reduceOnce} disabled={settings.fontSizePt <= LIMITS.fontSizePt.min}>
                    {t("overflow.reduce")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setAutoFit(true)} disabled={autoFit}>
                    {autoFit ? <Loader2 className="animate-spin" aria-hidden /> : <Wand2 aria-hidden />} {t("overflow.autoFit")}
                  </Button>
                  {settings.perPage > 1 && (
                    <Button size="sm" variant="outline" onClick={soloForOverflowing}>
                      {t("overflow.solo", { count: overflowList.length })}
                    </Button>
                  )}
                  {settings.perPage > 1 && (
                    <Button size="sm" variant="ghost" onClick={() => updateSettings({ ...settings, perPage: 1 })}>
                      {t("overflow.allOnePerPage")}
                    </Button>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
          {ids.length > 0 && overflowList.length === 0 && !measuring && (
            <p className="flex items-center gap-1.5 text-xs text-success-foreground" data-testid="fit-ok">
              <CheckCircle2 className="size-3.5" aria-hidden /> {t("fitOk")}
              <span className="ml-auto text-muted-foreground">{saveState === "saving" ? tc("saving") : saveState === "error" ? t("saveFailed") : ""}</span>
            </p>
          )}
          {measuring && ids.length > 0 && <p className="text-xs text-muted-foreground">{t("measuring")}</p>}
        </div>

        {/* Pages */}
        <div ref={centerRef} className="min-h-0 flex-1 overflow-auto px-6 py-4">
          {ids.length === 0 ? (
            <div className="mx-auto mt-16 max-w-sm text-center">
              <p className="font-medium">{t("empty.title")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("empty.description")}</p>
            </div>
          ) : (
            <div className="mx-auto" style={{ width: pageW * scale, height: totalH * scale }}>
              <div style={{ width: pageW, transform: `scale(${scale})`, transformOrigin: "top left" }} ref={previewRef}>
                <WorksheetDocument pages={pages} saints={cards} settings={settings} overflowIds={overflowIds} pageClassName="ws-preview-page" />
              </div>
            </div>
          )}
          {ids.length > 0 && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              <a href={`/imprimir?c=${encodeConfig(config)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline-offset-4 hover:underline">
                {t("openPrintView")} <ExternalLink className="size-3" aria-hidden />
              </a>
            </p>
          )}
        </div>
      </section>

      <aside className="hidden min-h-0 overflow-y-auto border-l xl:block" aria-label={t("settingsButton")}>
        {settingsPanel}
      </aside>
    </div>
  );
}
