"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, ChevronLeft, GripVertical, Loader2, Pencil, Plus, Printer, Search, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { matchesSearch } from "@/lib/text";
import { cn } from "@/lib/utils";
import { moveItem } from "@/lib/worksheet/paginate";
import { NameDialog } from "./name-dialog";

type SaintLite = { id: string; name: string; country: string; thumb: string | null };
type Props = { collection: { id: string; name: string; saintIds: string[] }; saints: SaintLite[] };

/** Edits membership and order. Every change is saved immediately (and rolled back if saving fails). */
export function CollectionEditor({ collection, saints }: Props) {
  const router = useRouter();
  const t = useTranslations("collections");
  const tc = useTranslations("common");
  const [name, setName] = useState(collection.name);
  const [ids, setIds] = useState(collection.saintIds);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const byId = useMemo(() => new Map(saints.map((s) => [s.id, s])), [saints]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const dndId = useId();
  const url = `/api/collections/${encodeURIComponent(collection.id)}`;

  async function save(next: string[]) {
    const prev = ids;
    setIds(next);
    setSaving(true);
    try {
      await api(url, { method: "PATCH", json: { saintIds: next } });
      router.refresh();
    } catch (e) {
      setIds(prev);
      toast.error(t("toast.saveFailed"), { description: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const available = saints.filter((s) => !ids.includes(s.id) && matchesSearch(`${s.name} ${s.country}`, query));

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    void save(moveItem(ids, ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id))));
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <Link href="/colecciones" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" aria-hidden /> {tc("collections")}
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{name}</h1>
        <Button variant="ghost" size="sm" onClick={() => setRenameOpen(true)}>
          <Pencil aria-hidden /> {tc("rename")}
        </Button>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {saving ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" aria-hidden /> {tc("saving")}
            </span>
          ) : (
            t("autosave")
          )}
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteOpen(true)}>
            <Trash2 aria-hidden /> {tc("delete")}
          </Button>
          <Button asChild disabled={ids.length === 0}>
            <Link href={`/crear-fichas?coleccion=${encodeURIComponent(collection.id)}`}>
              <Printer aria-hidden /> {t("printWith")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="members">
          <h2 id="members" className="mb-2 text-sm font-semibold">
            {t("printOrder", { count: ids.length })}
          </h2>
          {ids.length === 0 ? (
            <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">{t("emptyMembers")}</p>
          ) : (
            <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                <ol className="space-y-1.5" data-testid="collection-members">
                  {ids.map((id, i) => (
                    <MemberRow
                      key={id}
                      id={id}
                      index={i}
                      saint={byId.get(id)}
                      last={i === ids.length - 1}
                      onMove={(to) => save(moveItem(ids, i, to))}
                      onRemove={() => save(ids.filter((x) => x !== id))}
                    />
                  ))}
                </ol>
              </SortableContext>
            </DndContext>
          )}
        </section>

        <section aria-labelledby="add" className="space-y-2">
          <h2 id="add" className="text-sm font-semibold">{t("addSaints")}</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tc("search")} className="pl-8" aria-label={t("searchToAdd")} />
          </div>
          <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto rounded-lg border p-1">
            {available.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => save([...ids, s.id])} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted" aria-label={tc("addItem", { name: s.name })}>
                  <Plus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                </button>
              </li>
            ))}
            {available.length === 0 && <li className="px-2 py-1.5 text-xs text-muted-foreground">{query ? tc("noResults") : t("allInCollection")}</li>}
          </ul>
        </section>
      </div>

      <NameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title={t("renameTitle")}
        initialName={name}
        submitLabel={tc("save")}
        onSubmit={async (n) => {
          await api(url, { method: "PATCH", json: { name: n } });
          setName(n);
          toast.success(t("toast.renamed"));
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("delete.title", { name })}
        description={<p>{t("delete.body")}</p>}
        confirmLabel={t("delete.confirm")}
        destructive
        onConfirm={async () => {
          await api(url, { method: "DELETE" });
          toast.success(t("toast.deletedPlain"));
          router.push("/colecciones");
          router.refresh();
        }}
      />
    </div>
  );
}

function MemberRow({ id, index, saint, last, onMove, onRemove }: { id: string; index: number; saint?: SaintLite; last: boolean; onMove: (to: number) => void; onRemove: () => void }) {
  const t = useTranslations("collections");
  const tc = useTranslations("common");
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  const name = saint?.name ?? id;
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn("flex items-center gap-2 rounded-lg border bg-background px-2 py-1.5", isDragging && "z-10 shadow-lg")}>
      <button ref={setActivatorNodeRef} {...attributes} {...listeners} type="button" className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted" aria-label={tc("dragItem", { name })}>
        <GripVertical className="size-4" aria-hidden />
      </button>
      <span className="w-6 text-right text-xs tabular-nums text-muted-foreground">{index + 1}</span>
      {saint?.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- local thumbnail
        <img src={saint.thumb} alt="" className="h-9 w-7 rounded-sm border object-cover" />
      ) : (
        <div className="h-9 w-7 rounded-sm border border-dashed" />
      )}
      <Link href={`/santos/${encodeURIComponent(id)}`} className="min-w-0 flex-1 truncate text-sm hover:underline">
        {name}
      </Link>
      <span className="hidden truncate text-xs text-muted-foreground sm:inline">{saint?.country}</span>
      <Button variant="ghost" size="icon-xs" disabled={index === 0} onClick={() => onMove(index - 1)} aria-label={tc("moveUp", { name })}>
        <ArrowUp aria-hidden />
      </Button>
      <Button variant="ghost" size="icon-xs" disabled={last} onClick={() => onMove(index + 1)} aria-label={tc("moveDown", { name })}>
        <ArrowDown aria-hidden />
      </Button>
      <Button variant="ghost" size="icon-xs" onClick={onRemove} aria-label={t("removeFrom", { name })}>
        <X aria-hidden />
      </Button>
    </li>
  );
}
