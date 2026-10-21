"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { matchesSearch } from "@/lib/text";
import { cn } from "@/lib/utils";

type Props = { rows: LibraryRow[]; collections: CollectionSummary[]; seedAvailable: boolean };

export function SaintLibrary({ rows, collections, seedAvailable }: Props) {
  const router = useRouter();
  const t = useTranslations("library");
  const tc = useTranslations("common");
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
      toast.success(t("toast.addedTo", { name: collection.name }), { description: t("toast.totalSaints", { count: collection.saintIds.length }) });
      router.refresh();
    } catch (e) {
      toast.error(t("toast.collectionUpdateFailed"), { description: (e as Error).message });
    }
  }

  async function createCollectionFromSelection(name: string) {
    const ids = orderedSelection();
    const { collection } = await api<{ collection: CollectionSummary }>("/api/collections", { method: "POST", json: { name, saintIds: ids } });
    toast.success(t("toast.collectionCreated", { name: collection.name }), { description: tc("saints", { count: ids.length }) });
    router.refresh();
  }

  async function bulkSetReview(status: LibraryRow["reviewStatus"]) {
    const ids = orderedSelection();
    try {
      const { updated } = await api<{ updated: number }>("/api/saints", { method: "PATCH", json: { saintIds: ids, reviewStatus: status } });
      toast.success(status === "reviewed" ? t("toast.markedReviewed", { count: updated }) : t("toast.markedPending", { count: updated }));
      setSelected([]);
      router.refresh();
    } catch (e) {
      toast.error(t("toast.reviewFailed"), { description: (e as Error).message });
      throw e;
    }
  }

  async function duplicate(row: LibraryRow) {
    try {
      const { saint } = await api<{ saint: { id: string; name: string } }>(`/api/saints/${encodeURIComponent(row.id)}/duplicate`, { method: "POST" });
      toast.success(t("toast.copyCreated"), {
        description: saint.name,
        action: { label: tc("edit"), onClick: () => router.push(`/santos/${encodeURIComponent(saint.id)}`) },
      });
      router.refresh();
    } catch (e) {
      toast.error(t("toast.duplicateFailed"), { description: (e as Error).message });
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    try {
      await api(`/api/saints/${encodeURIComponent(toDelete.id)}`, { method: "DELETE" });
      toast.success(t("toast.deleted", { name: toDelete.name }));
      setSelected((s) => s.filter((x) => x !== toDelete.id));
      router.refresh();
    } catch (e) {
      toast.error(t("toast.deleteFailed"), { description: (e as Error).message });
      throw e;
    }
  }

  if (rows.length === 0) return <EmptyLibrary seedAvailable={seedAvailable} />;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tc("saints", { count: rows.length })}
            {needsReview > 0 && (
              <>
                {" · "}
                <button type="button" className="underline-offset-4 hover:underline" onClick={() => setReview("needs_review")}>
                  {t("pendingReview", { count: needsReview })}
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
                <Upload aria-hidden /> {t("importJson")}
              </Button>
            }
          />
          <Button variant="outline" asChild>
            <Link href="/santos/importar-retratos">
              <Images aria-hidden /> {t("importPortraits")}
            </Link>
          </Button>
          <Button asChild>
            <Link href="/santos/nuevo">
              <Plus aria-hidden /> {t("newSaint")}
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
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchLabel")}
              className="h-9 pl-8"
            />
          </div>
          <Select value={collectionId} onValueChange={setCollectionId}>
            <SelectTrigger className="h-9 w-[220px]" aria-label={t("filterCollection")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allCollections")}</SelectItem>
              {collections.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.saintIds.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={review} onValueChange={setReview}>
            <SelectTrigger className="h-9 w-[200px]" aria-label={t("filterReview")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("review.any")}</SelectItem>
              <SelectItem value="needs_review">{t("review.pending")}</SelectItem>
              <SelectItem value="reviewed">{t("review.reviewed")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t("filterCategory")}>
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
              <X aria-hidden /> {t("clearFilters")}
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
        <span className="text-sm font-medium">{tc("selected", { count: selected.length })}</span>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button size="sm" onClick={sendToBuilder}>
            <Printer aria-hidden /> {tc("printWorksheets")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <FolderPlus aria-hidden /> {t("addToCollection")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>{t("addTo")}</DropdownMenuLabel>
              {collections.map((c) => (
                <DropdownMenuItem key={c.id} onSelect={() => addToCollection(c.id)}>
                  {c.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setNewCollectionOpen(true)}>
                <Plus aria-hidden /> {t("newCollectionEllipsis")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <CircleCheck aria-hidden /> {t("review.menu")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>
                {selectedPending > 0 ? t("review.pendingOf", { pending: selectedPending, total: selected.length }) : t("review.allReviewed")}
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setConfirmReviewed(true)} disabled={selectedPending === 0}>
                <CircleCheck aria-hidden /> {t("review.markReviewedEllipsis")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void bulkSetReview("needs_review").catch(() => undefined)} disabled={selectedPending === selected.length}>
                <CircleDashed aria-hidden /> {t("review.markPending")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
            {t("clearSelection")}
          </Button>
        </div>
      </div>
      {selected.length === 0 && <div className="h-4" />}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-16 text-center">
          <p className="font-medium">{t("noMatches")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{query ? t("noResultsFor", { query }) : t("tryOtherFilter")}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
            {t("clearFilters")}
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
                    aria-label={t("selectAllVisible")}
                  />
                </TableHead>
                <TableHead className="w-14">
                  <span className="sr-only">{t("columns.portrait")}</span>
                </TableHead>
                <TableHead>{t("columns.name")}</TableHead>
                <TableHead className="hidden md:table-cell">{t("columns.country")}</TableHead>
                <TableHead className="hidden lg:table-cell">{t("columns.birth")}</TableHead>
                <TableHead className="hidden sm:table-cell">{t("columns.age")}</TableHead>
                <TableHead className="hidden xl:table-cell">{t("columns.categories")}</TableHead>
                <TableHead className="w-[120px] text-right">{t("columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const isSel = selected.includes(r.id);
                return (
                  <TableRow key={r.id} data-state={isSel ? "selected" : undefined} data-testid="saint-row">
                    <TableCell>
                      <Checkbox checked={isSel} onCheckedChange={(v) => toggle(r.id, !!v)} aria-label={t("selectSaint", { name: r.name })} />
                    </TableCell>
                    <TableCell className="py-1.5">
                      <Thumb row={r} />
                    </TableCell>
                    <TableCell className="max-w-[340px] whitespace-normal">
                      <Link href={`/santos/${encodeURIComponent(r.id)}`} className="font-medium underline-offset-4 hover:underline">
                        {r.name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{tc("characteristics", { count: r.characteristicCount })}</span>
                        {r.reviewStatus === "needs_review" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex items-center gap-1 rounded border border-warning/40 bg-warning/10 px-1.5 py-px text-[11px] text-warning-foreground">
                                <CircleAlert className="size-3" aria-hidden /> {t("review.badge")}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>{t("review.badgeTooltip")}</TooltipContent>
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
                          <Link href={`/santos/${encodeURIComponent(r.id)}`} aria-label={t("editSaint", { name: r.name })}>
                            <Pencil aria-hidden /> {tc("edit")}
                          </Link>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm" aria-label={tc("moreActionsFor", { name: r.name })}>
                              <MoreHorizontal aria-hidden />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onSelect={() => router.push(`/crear-fichas?ids=${encodeURIComponent(r.id)}`)}>
                              <Printer aria-hidden /> {tc("printWorksheet")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => duplicate(r)}>
                              <Copy aria-hidden /> {tc("duplicate")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(r)}>
                              <Trash2 aria-hidden /> {tc("deleteEllipsis")}
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
        {t("showing", { count: filtered.length, total: rows.length })}
      </p>

      <ConfirmDialog
        open={confirmReviewed}
        onOpenChange={setConfirmReviewed}
        title={t("review.confirmTitle", { count: selectedPending })}
        description={
          <>
            <p>{t("review.confirmBody")}</p>
            <p>{t("review.confirmUndo")}</p>
          </>
        }
        confirmLabel={t("review.markReviewed")}
        onConfirm={() => bulkSetReview("reviewed")}
      />

      <NameDialog
        open={newCollectionOpen}
        onOpenChange={setNewCollectionOpen}
        title={t("newCollection")}
        description={t("newCollectionDescription", { count: selected.length })}
        submitLabel={t("createCollection")}
        onSubmit={createCollectionFromSelection}
      />

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t("delete.title", { name: toDelete?.name ?? "" })}
        description={
          <>
            <p>{t("delete.body")}</p>
            {toDelete && toDelete.collectionIds.length > 0 && <p>{t("delete.collections", { count: toDelete.collectionIds.length })}</p>}
            <p className="font-medium text-foreground">{t("delete.warning")}</p>
          </>
        }
        confirmLabel={tc("delete")}
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function Thumb({ row }: { row: LibraryRow }) {
  const t = useTranslations("library");
  if (row.thumb) {
    // eslint-disable-next-line @next/next/no-img-element -- local thumbnail route
    return <img src={row.thumb} alt="" className="h-12 w-9 rounded-sm border object-cover" loading="lazy" />;
  }
  return (
    <div
      className="grid h-12 w-9 place-items-center rounded-sm border border-dashed text-muted-foreground"
      title={row.hasMissingPortrait ? t("portraitMissing") : t("noPortrait")}
    >
      {row.hasMissingPortrait ? <ImageOff className="size-3.5" aria-hidden /> : null}
    </div>
  );
}

function EmptyLibrary({ seedAvailable }: { seedAvailable: boolean }) {
  const t = useTranslations("library.empty");
  const tl = useTranslations("library");
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center px-6 py-20 text-center">
      <h1 className="font-heading text-3xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mt-3 text-muted-foreground">{t("description")}</p>
      {seedAvailable && (
        <div className="mt-8 w-full rounded-lg border bg-muted/30 p-5 text-left">
          <p className="font-medium">{t("seedFound")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.rich("seedLocation", { code: (chunks) => <code className="rounded bg-muted px-1">{chunks}</code> })}
          </p>
          <Button className="mt-4" asChild>
            <Link href="/configuracion/importar?seed=1">
              <FileDown aria-hidden /> {t("reviewAndImport")}
            </Link>
          </Button>
        </div>
      )}
      <div className="mt-6 flex gap-2">
        <ImportJsonDialog
          seedAvailable={seedAvailable}
          trigger={
            <Button variant={seedAvailable ? "outline" : "default"}>
              <Upload aria-hidden /> {tl("importJson")}
            </Button>
          }
        />
        <Button variant="outline" asChild>
          <Link href="/santos/nuevo">
            <Plus aria-hidden /> {t("addSaint")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
