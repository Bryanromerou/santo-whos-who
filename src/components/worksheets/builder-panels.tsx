"use client";

import { useId, useMemo, useState } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, ArrowDownAZ, FileText, GripVertical, Plus, RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { matchesSearch, pluralize } from "@/lib/text";
import { cn } from "@/lib/utils";
import { moveItem } from "@/lib/worksheet/paginate";
import { DEFAULT_SETTINGS, LIMITS, PAPER_SIZES, PHOTO_FIT_LABELS, type PhotoFit, type WorksheetSettings } from "@/lib/worksheet/settings";

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
          <h2 className="text-sm font-semibold">Santos en las fichas</h2>
          <span className="text-xs text-muted-foreground">{pluralize(selected.length, "seleccionado", "seleccionados")}</span>
        </div>
        <div className="flex gap-2">
          <Select value={collectionId} onValueChange={setCollectionId}>
            <SelectTrigger size="sm" className="h-8 min-w-0 flex-1" aria-label="Elegir colección">
              <SelectValue placeholder="Usar una colección…" />
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
              Reemplazar selección
            </Button>
            <Button size="xs" variant="outline" onClick={() => onChange([...selected, ...coll.saintIds.filter((id) => saints[id] && !selected.includes(id))])}>
              Añadir al final
            </Button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-muted-foreground">Ordenar:</span>
          <Button size="xs" variant="outline" onClick={() => sortBy("name")} disabled={selected.length < 2}>
            <ArrowDownAZ aria-hidden /> A–Z
          </Button>
          <Button size="xs" variant="outline" onClick={() => sortBy("birth")} disabled={selected.length < 2}>
            Nacimiento
          </Button>
          <Button size="xs" variant="outline" onClick={() => sortBy("country")} disabled={selected.length < 2}>
            País
          </Button>
          <Button size="xs" variant="outline" onClick={() => sortBy("reverse")} disabled={selected.length < 2}>
            Invertir
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {selected.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Aún no hay santos. Elige una colección o añádelos desde la lista de abajo.</p>
        ) : (
          <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={selected} strategy={verticalListSortingStrategy}>
              <ol className="space-y-1 p-2" aria-label="Orden de las fichas" data-testid="selected-list">
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
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Añadir santos</h3>
            {available.length > 0 && (
              <Button size="xs" variant="ghost" onClick={() => onChange([...selected, ...available])}>
                Añadir {available.length === allIds.length - selected.length && !query ? "todos" : `${available.length}`}
              </Button>
            )}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar santo…" className="h-8 pl-7 text-sm" aria-label="Buscar santos para añadir" />
          </div>
          <ul className="space-y-0.5">
            {available.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onChange([...selected, id])}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  aria-label={`Añadir ${saints[id].name}`}
                >
                  <Plus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{saints[id].name}</span>
                </button>
              </li>
            ))}
            {available.length === 0 && <li className="px-2 text-xs text-muted-foreground">{query ? "Sin resultados." : "Todos los santos están en las fichas."}</li>}
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
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group flex items-center gap-1 rounded-md border bg-background px-1 py-1", isDragging && "z-10 shadow-lg", props.overflow && "border-destructive/60 bg-destructive/5")}
    >
      <button ref={setActivatorNodeRef} {...attributes} {...listeners} type="button" className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted" aria-label={`Arrastrar ${props.name}`}>
        <GripVertical className="size-3.5" aria-hidden />
      </button>
      <span className="w-5 text-right text-xs tabular-nums text-muted-foreground">{props.index + 1}</span>
      <span className="min-w-0 flex-1 truncate text-sm" title={props.name}>
        {props.name}
      </span>
      {props.overflow && <span className="sr-only">(no cabe)</span>}
      {props.canSolo && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              size="icon-xs"
              variant={props.solo ? "secondary" : "ghost"}
              aria-pressed={props.solo}
              onClick={props.onToggleSolo}
              aria-label={props.solo ? `${props.name}: volver a compartir página` : `${props.name}: usar una página completa`}
              className={cn(!props.solo && "opacity-60 group-hover:opacity-100")}
            >
              <FileText aria-hidden />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{props.solo ? "Ocupa una página completa" : "Usar una página completa para este santo"}</TooltipContent>
        </Tooltip>
      )}
      <Button type="button" size="icon-xs" variant="ghost" disabled={props.index === 0} onClick={() => props.onMove(props.index - 1)} aria-label={`Subir ${props.name}`}>
        <ArrowUp aria-hidden />
      </Button>
      <Button type="button" size="icon-xs" variant="ghost" disabled={props.isLast} onClick={() => props.onMove(props.index + 1)} aria-label={`Bajar ${props.name}`}>
        <ArrowDown aria-hidden />
      </Button>
      <Button type="button" size="icon-xs" variant="ghost" onClick={props.onRemove} aria-label={`Quitar ${props.name}`}>
        <X aria-hidden />
      </Button>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* Right: print settings                                                */
/* ------------------------------------------------------------------ */

export function SettingsPanel({ settings, onChange }: { settings: WorksheetSettings; onChange: (s: WorksheetSettings) => void }) {
  const set = <K extends keyof WorksheetSettings>(k: K, v: WorksheetSettings[K]) => onChange({ ...settings, [k]: v });
  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Ajustes de impresión</h2>
        <Button size="xs" variant="ghost" onClick={() => onChange(DEFAULT_SETTINGS)}>
          <RotateCcw aria-hidden /> Restablecer
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor="paper">Tamaño de papel</Label>
        <Select value={settings.paperSize} onValueChange={(v) => set("paperSize", v as WorksheetSettings["paperSize"])}>
          <SelectTrigger id="paper" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PAPER_SIZES).map(([k, p]) => (
              <SelectItem key={k} value={k}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Santos por página</Label>
        <Tabs value={String(settings.perPage)} onValueChange={(v) => set("perPage", Number(v) as WorksheetSettings["perPage"])}>
          <TabsList className="w-full">
            <TabsTrigger value="1" className="flex-1">1</TabsTrigger>
            <TabsTrigger value="2" className="flex-1">2</TabsTrigger>
            <TabsTrigger value="4" className="flex-1">4</TabsTrigger>
          </TabsList>
        </Tabs>
        {settings.perPage === 4 && <p className="text-xs text-muted-foreground">Cuatro por página solo funciona con textos cortos; revisa los avisos.</p>}
      </div>

      <RangeField label="Tamaño de letra" unit="pt" value={settings.fontSizePt} limits={LIMITS.fontSizePt} onChange={(v) => set("fontSizePt", v)} />
      <RangeField label="Espacio entre viñetas" unit="pt" value={settings.bulletSpacingPt} limits={LIMITS.bulletSpacingPt} onChange={(v) => set("bulletSpacingPt", v)} />
      <RangeField label="Márgenes" unit="in" value={settings.marginIn} limits={LIMITS.marginIn} onChange={(v) => set("marginIn", v)} digits={2} />
      <RangeField label="Ancho de la foto" unit="%" value={settings.imageWidthPct} limits={LIMITS.imageWidthPct} onChange={(v) => set("imageWidthPct", v)} disabled={!settings.showPortrait} />

      <div className={cn("space-y-2", !settings.showPortrait && "opacity-50")}>
        <Label htmlFor="photoFit">Encuadre de las fotos</Label>
        <Select value={settings.photoFit} onValueChange={(v) => set("photoFit", v as PhotoFit)} disabled={!settings.showPortrait}>
          <SelectTrigger id="photoFit" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(PHOTO_FIT_LABELS) as PhotoFit[]).map((k) => (
              <SelectItem key={k} value={k}>
                {PHOTO_FIT_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {settings.photoFit === "contain"
            ? "Se ve la foto entera; si su forma no es 3:4 queda espacio en blanco alrededor."
            : settings.photoFit === "cover"
              ? "Todas llenan el recuadro; los bordes que sobran se recortan."
              : "Usa el encuadre elegido en cada santo (por defecto, recortar para llenar)."}
        </p>
      </div>

      <div className="space-y-3">
        <ToggleField id="showPortrait" label="Mostrar retrato" checked={settings.showPortrait} onChange={(v) => set("showPortrait", v)} />
        <ToggleField id="showCountry" label="Mostrar país de origen" checked={settings.showCountry} onChange={(v) => set("showCountry", v)} />
        <ToggleField id="showPageNumbers" label="Numerar páginas" checked={settings.showPageNumbers} onChange={(v) => set("showPageNumbers", v)} />
      </div>
      <p className="text-xs text-muted-foreground">Los ajustes se guardan automáticamente en este equipo.</p>
    </div>
  );
}

function RangeField(props: { label: string; unit: string; value: number; limits: { min: number; max: number; step: number }; onChange: (v: number) => void; digits?: number; disabled?: boolean }) {
  const id = useId();
  return (
    <div className={cn("space-y-2", props.disabled && "opacity-50")}>
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{props.label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {props.value.toFixed(props.digits ?? (props.limits.step < 1 ? 1 : 0))} {props.unit}
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
