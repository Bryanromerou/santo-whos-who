"use client";

import { useId, useMemo, useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useFormatter, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ArrowDownAZ, FileText, GripVertical, Plus, RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { matchesSearch } from "@/lib/text";
import { cn } from "@/lib/utils";
import { moveItem } from "@/lib/worksheet/paginate";
import { DEFAULT_SETTINGS, LIMITS, PAPER_SIZES, PHOTO_FITS, type PaperSize, type PhotoFit, type WorksheetSettings } from "@/lib/worksheet/settings";

export type PickerSaint = { id: string; name: string; country: string; birthYear: number | null; searchText: string };
export type PickerCollection = { id: string; name: string; saintIds: string[] };

/* ------------------------------------------------------------------ */
/* Left: selection and ordering                                         */
/* ------------------------------------------------------------------ */

type SelectionProps = {
  saints: Record<string, PickerSaint>;
  allIds: string[];
  collections: PickerCollection[];
  selected: string[];
  soloIds: string[];
  overflowIds: ReadonlySet<string>;
  perPage: number;
  onChange: (ids: string[]) => void;
  onToggleSolo: (id: string) => void;
};

export function SelectionPanel({ saints, allIds, collections, selected, soloIds, overflowIds, perPage, onChange, onToggleSolo }: SelectionProps) {
  const t = useTranslations("builder.selection");
  const tc = useTranslations("common");
  const [query, setQuery] = useState("");
  const [collectionId, setCollectionId] = useState<string>("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const dndId = useId();

  const available = useMemo(
    () => allIds.filter((id) => !selected.includes(id) && matchesSearch(saints[id].searchText, query)),
    [allIds, selected, saints, query],
  );

  const sortBy = (key: "name" | "birth" | "country" | "reverse") => {
    if (key === "reverse") return onChange([...selected].reverse());
    const list = [...selected];
    list.sort((a, b) => {
      const A = saints[a];
      const B = saints[b];
      if (key === "name") return A.name.localeCompare(B.name, "es");
      if (key === "country") return A.country.localeCompare(B.country, "es") || A.name.localeCompare(B.name, "es");
      return (A.birthYear ?? Infinity) - (B.birthYear ?? Infinity);
    });
    onChange(list);
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    onChange(moveItem(selected, selected.indexOf(String(e.active.id)), selected.indexOf(String(e.over.id))));
  };

  const coll = collections.find((c) => c.id === collectionId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3 border-b p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">{t("title")}</h2>
          <span className="text-xs text-muted-foreground">{tc("selected", { count: selected.length })}</span>
        </div>
        <div className="flex gap-2">
          <Select value={collectionId} onValueChange={setCollectionId}>
            <SelectTrigger size="sm" className="h-8 min-w-0 flex-1" aria-label={t("chooseCollection")}>
              <SelectValue placeholder={t("useCollection")} />
            </SelectTrigger>
            <SelectContent>
              {collections.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.saintIds.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {coll && (
          <div className="flex gap-2">
            <Button size="xs" onClick={() => onChange(coll.saintIds.filter((id) => saints[id]))}>
              {t("replaceSelection")}
            </Button>
            <Button size="xs" variant="outline" onClick={() => onChange([...selected, ...coll.saintIds.filter((id) => saints[id] && !selected.includes(id))])}>
              {t("appendToEnd")}
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-muted-foreground">{t("sort")}</span>
          <Button size="xs" variant="outline" onClick={() => sortBy("name")} disabled={selected.length < 2}>
            <ArrowDownAZ aria-hidden /> A–Z
          </Button>
          <Button size="xs" variant="outline" onClick={() => sortBy("birth")} disabled={selected.length < 2}>
            {t("sortBirth")}
          </Button>
          <Button size="xs" variant="outline" onClick={() => sortBy("country")} disabled={selected.length < 2}>
            {t("sortCountry")}
          </Button>
          <Button size="xs" variant="outline" onClick={() => sortBy("reverse")} disabled={selected.length < 2}>
            {t("sortReverse")}
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {selected.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={selected} strategy={verticalListSortingStrategy}>
              <ol className="space-y-1 p-2" aria-label={t("orderAria")} data-testid="selected-list">
                {selected.map((id, i) => (
                  <SelectedRow
                    key={id}
                    id={id}
                    index={i}
                    name={saints[id]?.name ?? id}
                    isLast={i === selected.length - 1}
                    solo={soloIds.includes(id)}
                    canSolo={perPage > 1}
                    overflow={overflowIds.has(id)}
                    onMove={(to) => onChange(moveItem(selected, i, to))}
                    onRemove={() => onChange(selected.filter((x) => x !== id))}
                    onToggleSolo={() => onToggleSolo(id)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}

        <div className="space-y-2 border-t p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t("addSaints")}</h3>
            {available.length > 0 && (
              <Button size="xs" variant="ghost" onClick={() => onChange([...selected, ...available])}>
                {available.length === allIds.length - selected.length && !query ? t("addAll") : t("addCount", { count: available.length })}
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchPlaceholder")} className="h-8 pl-7 text-sm" aria-label={t("searchAria")} />
          </div>
          <ul className="space-y-0.5">
            {available.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onChange([...selected, id])}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  aria-label={tc("addItem", { name: saints[id].name })}
                >
                  <Plus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{saints[id].name}</span>
                </button>
              </li>
            ))}
            {available.length === 0 && <li className="px-2 text-xs text-muted-foreground">{query ? tc("noResults") : t("allAdded")}</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SelectedRow(props: {
  id: string;
  index: number;
  name: string;
  isLast: boolean;
  solo: boolean;
  canSolo: boolean;
  overflow: boolean;
  onMove: (to: number) => void;
  onRemove: () => void;
  onToggleSolo: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: props.id });
  const t = useTranslations("builder.selection");
  const tc = useTranslations("common");
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group flex items-center gap-1 rounded-md border bg-background px-1 py-1", isDragging && "z-10 shadow-lg", props.overflow && "border-destructive/60 bg-destructive/5")}
    >
      <button ref={setActivatorNodeRef} {...attributes} {...listeners} type="button" className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted" aria-label={tc("dragItem", { name: props.name })}>
        <GripVertical className="size-3.5" aria-hidden />
      </button>
      <span className="w-5 text-right text-xs tabular-nums text-muted-foreground">{props.index + 1}</span>
      <span className="min-w-0 flex-1 truncate text-sm" title={props.name}>
        {props.name}
      </span>
      {props.overflow && <span className="sr-only">{t("doesNotFit")}</span>}
      {props.canSolo && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-xs"
              variant={props.solo ? "secondary" : "ghost"}
              aria-pressed={props.solo}
              onClick={props.onToggleSolo}
              aria-label={props.solo ? t("soloOffAria", { name: props.name }) : t("soloOnAria", { name: props.name })}
              className={cn(!props.solo && "opacity-60 group-hover:opacity-100")}
            >
              <FileText aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{props.solo ? t("soloOn") : t("soloOff")}</TooltipContent>
        </Tooltip>
      )}
      <Button type="button" size="icon-xs" variant="ghost" disabled={props.index === 0} onClick={() => props.onMove(props.index - 1)} aria-label={tc("moveUp", { name: props.name })}>
        <ArrowUp aria-hidden />
      </Button>
      <Button type="button" size="icon-xs" variant="ghost" disabled={props.isLast} onClick={() => props.onMove(props.index + 1)} aria-label={tc("moveDown", { name: props.name })}>
        <ArrowDown aria-hidden />
      </Button>
      <Button type="button" size="icon-xs" variant="ghost" onClick={props.onRemove} aria-label={t("remove", { name: props.name })}>
        <X aria-hidden />
      </Button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Right: print settings                                                */
/* ------------------------------------------------------------------ */

export function SettingsPanel({ settings, onChange }: { settings: WorksheetSettings; onChange: (s: WorksheetSettings) => void }) {
  const t = useTranslations("builder");
  const tc = useTranslations("common");
  const set = <K extends keyof WorksheetSettings>(k: K, v: WorksheetSettings[K]) => onChange({ ...settings, [k]: v });
  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("settings.title")}</h2>
        <Button size="xs" variant="ghost" onClick={() => onChange(DEFAULT_SETTINGS)}>
          <RotateCcw aria-hidden /> {tc("reset")}
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="paper">{t("settings.paper")}</Label>
        <Select value={settings.paperSize} onValueChange={(v) => set("paperSize", v as WorksheetSettings["paperSize"])}>
          <SelectTrigger id="paper" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PAPER_SIZES) as PaperSize[]).map((k) => (
              <SelectItem key={k} value={k}>
                {t(`paper.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t("settings.perPage")}</Label>
        <Tabs value={String(settings.perPage)} onValueChange={(v) => set("perPage", Number(v) as WorksheetSettings["perPage"])}>
          <TabsList className="w-full">
            <TabsTrigger value="1" className="flex-1">1</TabsTrigger>
            <TabsTrigger value="2" className="flex-1">2</TabsTrigger>
            <TabsTrigger value="4" className="flex-1">4</TabsTrigger>
          </TabsList>
        </Tabs>
        {settings.perPage === 4 && <p className="text-xs text-muted-foreground">{t("settings.fourPerPage")}</p>}
      </div>

      <RangeField label={t("settings.fontSize")} unit="pt" value={settings.fontSizePt} limits={LIMITS.fontSizePt} onChange={(v) => set("fontSizePt", v)} />
      <RangeField label={t("settings.bulletSpacing")} unit="pt" value={settings.bulletSpacingPt} limits={LIMITS.bulletSpacingPt} onChange={(v) => set("bulletSpacingPt", v)} />
      <RangeField label={t("settings.margins")} unit="in" value={settings.marginIn} limits={LIMITS.marginIn} onChange={(v) => set("marginIn", v)} digits={2} />
      <RangeField label={t("settings.photoWidth")} unit="%" value={settings.imageWidthPct} limits={LIMITS.imageWidthPct} onChange={(v) => set("imageWidthPct", v)} disabled={!settings.showPortrait} />

      <div className={cn("space-y-2", !settings.showPortrait && "opacity-50")}>
        <Label htmlFor="photoFit">{t("settings.photoFit")}</Label>
        <Select value={settings.photoFit} onValueChange={(v) => set("photoFit", v as PhotoFit)} disabled={!settings.showPortrait}>
          <SelectTrigger id="photoFit" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PHOTO_FITS.map((k) => (
              <SelectItem key={k} value={k}>
                {t(`photoFit.${k}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {t(`photoFitHelp.${settings.photoFit}`)}
        </p>
      </div>

      <div className="space-y-3">
        <ToggleField id="showPortrait" label={t("settings.showPortrait")} checked={settings.showPortrait} onChange={(v) => set("showPortrait", v)} />
        <ToggleField id="showCountry" label={t("settings.showCountry")} checked={settings.showCountry} onChange={(v) => set("showCountry", v)} />
        <ToggleField id="showPageNumbers" label={t("settings.pageNumbers")} checked={settings.showPageNumbers} onChange={(v) => set("showPageNumbers", v)} />
      </div>
      <p className="text-xs text-muted-foreground">{t("settings.autosave")}</p>
    </div>
  );
}

function RangeField(props: { label: string; unit: string; value: number; limits: { min: number; max: number; step: number }; onChange: (v: number) => void; digits?: number; disabled?: boolean }) {
  const id = useId();
  const format = useFormatter();
  const digits = props.digits ?? (props.limits.step < 1 ? 1 : 0);
  return (
    <div className={cn("space-y-2", props.disabled && "opacity-50")}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{props.label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {format.number(props.value, { minimumFractionDigits: digits, maximumFractionDigits: digits })} {props.unit}
        </span>
      </div>
      <Slider id={id} disabled={props.disabled} value={[props.value]} min={props.limits.min} max={props.limits.max} step={props.limits.step} onValueChange={([v]) => props.onChange(v)} aria-label={props.label} />
    </div>
  );
}

function ToggleField({ id, label, checked, onChange }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
