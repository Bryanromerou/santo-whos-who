"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Copy,
  FileDown,
  FolderPlus,
  Images,
  ImageOff,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { NameDialog } from "@/components/collections/name-dialog";
import { ImportJsonDialog } from "@/components/settings/import-json-dialog";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { categoryLabel, FEATURED_CATEGORIES } from "@/lib/categories";
import { api } from "@/lib/client-api";
import type { CollectionSummary, LibraryRow } from "@/lib/library-view";
import { matchesSearch, pluralize } from "@/lib/text";
import { cn } from "@/lib/utils";

type Props = { rows: LibraryRow[]; collections: CollectionSummary[]; seedAvailable: boolean };

export function SaintLibrary({ rows, collections, seedAvailable }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [collectionId, setCollectionId] = useState("all");
  const [review, setReview] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [toDelete, setToDelete] = useState<LibraryRow | null>(null);
  const [newCollectionOpen, setNewCollectionOpen] = useState(false);
  const [confirmReviewed, setConfirmReviewed] = useState(false);

  const allCategories = useMemo(() => {
    const present = new Set(rows.flatMap((r) => r.categories));
    const featured = FEATURED_CATEGORIES.filter((c) => present.has(c));
    const rest = [...present].filter((c) => !featured.includes(c)).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b), "es"));
    return [...featured, ...rest];
  }, [rows]);

  const filtered = useMemo(() => {
    const coll = collections.find((c) => c.id === collectionId);
    let list = rows.filter((r) => {
      if (categories.length && !categories.every((c) => r.categories.includes(c) || (c === "martires" && r.isMartyr))) return false;
      if (coll && !coll.saintIds.includes(r.id)) return false;
      if (review !== "all" && r.reviewStatus !== review) return false;
      return matchesSearch(r.searchText, query);
    });
    // Inside a collection, show the collection's own order.
    if (coll) list = [...list].sort((a, b) => coll.saintIds.indexOf(a.id) - coll.saintIds.indexOf(b.id));
    return list;
  }, [rows, categories, collectionId, review, query, collections]);

  const filtersActive = query || categories.length || collectionId !== "all" || review !== "all";
  const visibleIds = filtered.map((r) => r.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const needsReview = rows.filter((r) => r.reviewStatus === "needs_review").length;
  const selectedPending = rows.filter((r) => selected.includes(r.id) && r.reviewStatus === "needs_review").length;

  const toggle = (id: string, on: boolean) => setSelected((s) => (on ? [...s.filter((x) => x !== id), id] : s.filter((x) => x !== id)));
  const clearFilters = () => {
    setQuery("");
    setCategories([]);
    setCollectionId("all");
    setReview("all");
  };

  /** Selected ids in the order they appear on screen. */
  const orderedSelection = () => {
    const vis = visibleIds.filter((id) => selected.includes(id));
    return [...vis, ...selected.filter((id) => !vis.includes(id))];
  };

  const sendToBuilder = () => router.push(`/crear-fichas?ids=${orderedSelection().map(encodeURIComponent).join(",")}`);

  async function addToCollection(id: string) {
    try {
      const { collection } = await api<{ collection: CollectionSummary }>(`/api/collections/${encodeURIComponent(id)}`, {
        method: "PATCH",
        json: { addSaintIds: orderedSelection() },
      });
      toast.success(`Añadidos a «${collection.name}»`, { description: pluralize(collection.saintIds.length, "santo en total", "santos en total") });
      router.refresh();
    } catch (e) {
      toast.error("No se pudo actualizar la colección", { description: (e as Error).message });
    }
  }

  async function createCollectionFromSelection(name: string) {
    const ids = orderedSelection();
    const { collection } = await api<{ collection: CollectionSummary }>("/api/collections", { method: "POST", json: { name, saintIds: ids } });
    toast.success(`Colección «${collection.name}» creada`, { description: pluralize(ids.length, "santo", "santos") });
    router.refresh();
  }

  async function bulkSetReview(status: LibraryRow["reviewStatus"]) {
    const ids = orderedSelection();
    try {
      const { updated } = await api<{ updated: number }>("/api/saints", { method: "PATCH", json: { saintIds: ids, reviewStatus: status } });
      toast.success(
        status === "reviewed"
          ? pluralize(updated, "santo marcado como revisado", "santos marcados como revisados")
          : pluralize(updated, "santo marcado como pendiente", "santos marcados como pendientes"),
      );
      setSelected([]);
      router.refresh();
    } catch (e) {
      toast.error("No se pudo cambiar el estado de revisión", { description: (e as Error).message });
      throw e;
    }
  }

  async function duplicate(row: LibraryRow) {
    try {
      const { saint } = await api<{ saint: { id: string; name: string } }>(`/api/saints/${encodeURIComponent(row.id)}/duplicate`, { method: "POST" });
      toast.success("Copia creada", {
        description: saint.name,
        action: { label: "Editar", onClick: () => router.push(`/santos/${encodeURIComponent(saint.id)}`) },
      });
      router.refresh();
    } catch (e) {
      toast.error("No se pudo duplicar", { description: (e as Error).message });
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await api(`/api/saints/${encodeURIComponent(toDelete.id)}`, { method: "DELETE" });
      toast.success(`«${toDelete.name}» eliminado`);
      setSelected((s) => s.filter((x) => x !== toDelete.id));
      router.refresh();
    } catch (e) {
      toast.error("No se pudo eliminar", { description: (e as Error).message });
      throw e;
    }
  }

  if (rows.length === 0) return <EmptyLibrary seedAvailable={seedAvailable} />;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Biblioteca de Santos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {pluralize(rows.length, "santo", "santos")}
            {needsReview > 0 && (
              <>
                {" · "}
                <button type="button" className="underline-offset-4 hover:underline" onClick={() => setReview("needs_review")}>
                  {pluralize(needsReview, "pendiente de revisión histórica", "pendientes de revisión histórica")}
                </button>
              </>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <ImportJsonDialog
            seedAvailable={seedAvailable}
            trigger={
              <Button variant="outline">
                <Upload aria-hidden /> Importar JSON
              </Button>
            }
          />
          <Button variant="outline" asChild>
            <Link href="/santos/importar-retratos">
              <Images aria-hidden /> Importar retratos
            </Link>
          </Button>
          <Button asChild>
            <Link href="/santos/nuevo">
              <Plus aria-hidden /> Nuevo santo
            </Link>
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, país, patronazgo o característica…"
              aria-label="Buscar santos"
              className="h-9 pl-8"
            />
          </div>
          <Select value={collectionId} onValueChange={setCollectionId}>
            <SelectTrigger className="h-9 w-[220px]" aria-label="Filtrar por colección">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las colecciones</SelectItem>
              {collections.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.saintIds.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={review} onValueChange={setReview}>
            <SelectTrigger className="h-9 w-[200px]" aria-label="Filtrar por revisión">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Cualquier revisión</SelectItem>
              <SelectItem value="needs_review">Pendientes de revisión</SelectItem>
              <SelectItem value="reviewed">Revisados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por categoría">
          {allCategories.map((c) => {
            const on = categories.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                onClick={() => setCategories((cs) => (on ? cs.filter((x) => x !== c) : [...cs, c]))}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  on ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {categoryLabel(c)}
              </button>
            );
          })}
          {filtersActive ? (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-1 text-xs">
              <X aria-hidden /> Limpiar filtros
            </Button>
          ) : null}
        </div>
      </div>

      {/* Selection bar */}
      <div
        className={cn(
          "sticky top-14 z-20 my-4 flex flex-wrap items-center gap-2 rounded-lg border bg-background px-3 py-2 shadow-xs",
          selected.length === 0 && "hidden",
        )}
        aria-live="polite"
      >
        <span className="text-sm font-medium">{pluralize(selected.length, "seleccionado", "seleccionados")}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" onClick={sendToBuilder}>
            <Printer aria-hidden /> Crear fichas
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <FolderPlus aria-hidden /> Añadir a colección
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Añadir a…</DropdownMenuLabel>
              {collections.map((c) => (
                <DropdownMenuItem key={c.id} onSelect={() => addToCollection(c.id)}>
                  {c.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setNewCollectionOpen(true)}>
                <Plus aria-hidden /> Nueva colección…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <CircleCheck aria-hidden /> Revisión
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                {selectedPending > 0 ? `${selectedPending} de ${selected.length} pendientes` : "Todos ya están revisados"}
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setConfirmReviewed(true)} disabled={selectedPending === 0}>
                <CircleCheck aria-hidden /> Marcar como revisados…
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void bulkSetReview("needs_review").catch(() => undefined)} disabled={selectedPending === selected.length}>
                <CircleDashed aria-hidden /> Marcar como pendientes
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            Quitar selección
          </Button>
        </div>
      </div>
      {selected.length === 0 && <div className="h-4" />}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="font-medium">Ningún santo coincide con los filtros.</p>
          <p className="mt-1 text-sm text-muted-foreground">{query ? `No hay resultados para «${query}».` : "Prueba con otra categoría o colección."}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allVisibleSelected ? true : visibleIds.some((id) => selected.includes(id)) ? "indeterminate" : false}
                    onCheckedChange={(v) => setSelected((s) => (v ? [...new Set([...s, ...visibleIds])] : s.filter((id) => !visibleIds.includes(id))))}
                    aria-label="Seleccionar todos los visibles"
                  />
                </TableHead>
                <TableHead className="w-14">
                  <span className="sr-only">Retrato</span>
                </TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden md:table-cell">País</TableHead>
                <TableHead className="hidden lg:table-cell">Nacimiento</TableHead>
                <TableHead className="hidden sm:table-cell">Edad al morir</TableHead>
                <TableHead className="hidden xl:table-cell">Categorías</TableHead>
                <TableHead className="w-[120px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const isSel = selected.includes(r.id);
                return (
                  <TableRow key={r.id} data-state={isSel ? "selected" : undefined} data-testid="saint-row">
                    <TableCell>
                      <Checkbox checked={isSel} onCheckedChange={(v) => toggle(r.id, !!v)} aria-label={`Seleccionar ${r.name}`} />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Thumb row={r} />
                    </TableCell>
                    <TableCell className="max-w-[340px] whitespace-normal">
                      <Link href={`/santos/${encodeURIComponent(r.id)}`} className="font-medium underline-offset-4 hover:underline">
                        {r.name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{pluralize(r.characteristicCount, "característica", "características")}</span>
                        {r.reviewStatus === "needs_review" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 rounded border border-warning/40 bg-warning/10 px-1.5 py-px text-[11px] text-warning-foreground">
                                <CircleAlert className="size-3" aria-hidden /> Revisión pendiente
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Los datos históricos aún no se han verificado.</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden whitespace-normal md:table-cell">{r.country || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{r.birth}</TableCell>
                    <TableCell className="hidden sm:table-cell">{r.age}</TableCell>
                    <TableCell className="hidden max-w-[260px] whitespace-normal xl:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {r.categories.map((c) => (
                          <Badge key={c} variant="secondary" className="font-normal">
                            {categoryLabel(c)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/santos/${encodeURIComponent(r.id)}`} aria-label={`Editar ${r.name}`}>
                            <Pencil aria-hidden /> Editar
                          </Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={`Más acciones para ${r.name}`}>
                              <MoreHorizontal aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => router.push(`/crear-fichas?ids=${encodeURIComponent(r.id)}`)}>
                              <Printer aria-hidden /> Crear ficha
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => duplicate(r)}>
                              <Copy aria-hidden /> Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(r)}>
                              <Trash2 aria-hidden /> Eliminar…
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Mostrando {pluralize(filtered.length, "santo", "santos")} de {rows.length}.
      </p>

      <ConfirmDialog
        open={confirmReviewed}
        onOpenChange={setConfirmReviewed}
        title={`¿Marcar ${pluralize(selectedPending, "santo", "santos")} como revisado${selectedPending === 1 ? "" : "s"}?`}
        description={
          <>
            <p>Confirma que comprobaste sus datos históricos (fechas, edad, país y características) con una fuente confiable.</p>
            <p>Puedes volver a marcarlos como pendientes en cualquier momento.</p>
          </>
        }
        confirmLabel="Marcar como revisados"
        onConfirm={() => bulkSetReview("reviewed")}
      />

      <NameDialog
        open={newCollectionOpen}
        onOpenChange={setNewCollectionOpen}
        title="Nueva colección"
        description={`Se creará con ${pluralize(selected.length, "santo seleccionado", "santos seleccionados")}.`}
        submitLabel="Crear colección"
        onSubmit={createCollectionFromSelection}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`¿Eliminar a ${toDelete?.name ?? ""}?`}
        description={
          <>
            <p>Se borrarán sus características y su retrato (si ningún otro santo lo usa).</p>
            {toDelete && toDelete.collectionIds.length > 0 && (
              <p>También se quitará de {pluralize(toDelete.collectionIds.length, "colección", "colecciones")}.</p>
            )}
            <p className="font-medium text-foreground">Esta acción no se puede deshacer. Considera descargar un respaldo antes.</p>
          </>
        }
        confirmLabel="Eliminar"
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function Thumb({ row }: { row: LibraryRow }) {
  if (row.thumb) {
    // eslint-disable-next-line @next/next/no-img-element -- local thumbnail route
    return <img src={row.thumb} alt="" className="h-12 w-9 rounded-sm border object-cover" loading="lazy" />;
  }
  return (
    <div
      className="grid h-12 w-9 place-items-center rounded-sm border border-dashed text-muted-foreground"
      title={row.hasMissingPortrait ? "Falta el archivo del retrato" : "Sin retrato"}
    >
      {row.hasMissingPortrait ? <ImageOff className="size-3.5" aria-hidden /> : null}
    </div>
  );
}

function EmptyLibrary({ seedAvailable }: { seedAvailable: boolean }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center px-6 py-20 text-center">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">Tu biblioteca está vacía</h1>
      <p className="mt-3 text-muted-foreground">
        Importa tu archivo de santos en formato JSON para empezar, o agrega un santo a mano. Todo se guarda en este equipo.
      </p>
      {seedAvailable && (
        <div className="mt-8 w-full rounded-lg border bg-muted/30 p-5 text-left">
          <p className="font-medium">Se encontró santos_studio_43_santos.json</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Está en la carpeta <code className="rounded bg-muted px-1">seed/</code>. Revisa la vista previa antes de importar.
          </p>
          <Button className="mt-4" asChild>
            <Link href="/configuracion/importar?seed=1">
              <FileDown aria-hidden /> Revisar e importar
            </Link>
          </Button>
        </div>
      )}
      <div className="mt-6 flex gap-2">
        <ImportJsonDialog
          seedAvailable={seedAvailable}
          trigger={
            <Button variant={seedAvailable ? "outline" : "default"}>
              <Upload aria-hidden /> Importar JSON
            </Button>
          }
        />
        <Button variant="outline" asChild>
          <Link href="/santos/nuevo">
            <Plus aria-hidden /> Agregar santo
          </Link>
        </Button>
      </div>
    </div>
  );
}
