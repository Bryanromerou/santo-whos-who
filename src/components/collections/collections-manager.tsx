"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, FolderOpen, MoreHorizontal, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/client-api";
import { moveItem } from "@/lib/worksheet/paginate";
import { NameDialog } from "./name-dialog";

export type CollectionCard = { id: string; name: string; count: number; preview: string[] };

export function CollectionsManager({ collections: initial }: { collections: CollectionCard[] }) {
  const router = useRouter();
  const t = useTranslations("collections");
  const tc = useTranslations("common");
  const [collections, setCollections] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<CollectionCard | null>(null);
  const [deleting, setDeleting] = useState<CollectionCard | null>(null);

  async function create(name: string) {
    const { collection } = await api<{ collection: { id: string; name: string } }>("/api/collections", { method: "POST", json: { name } });
    toast.success(t("toast.created", { name: collection.name }));
    router.push(`/colecciones/${encodeURIComponent(collection.id)}`);
  }

  async function rename(name: string) {
    if (!renaming) return;
    await api(`/api/collections/${encodeURIComponent(renaming.id)}`, { method: "PATCH", json: { name } });
    setCollections((cs) => cs.map((c) => (c.id === renaming.id ? { ...c, name } : c)));
    toast.success(t("toast.renamed"));
    router.refresh();
  }

  async function remove() {
    if (!deleting) return;
    try {
      await api(`/api/collections/${encodeURIComponent(deleting.id)}`, { method: "DELETE" });
      setCollections((cs) => cs.filter((c) => c.id !== deleting.id));
      toast.success(t("toast.deleted", { name: deleting.name }), { description: t("toast.saintsKept") });
      router.refresh();
    } catch (e) {
      toast.error(t("toast.deleteFailed"), { description: (e as Error).message });
      throw e;
    }
  }

  async function move(index: number, to: number) {
    const prev = collections;
    const next = moveItem(collections, index, to);
    setCollections(next);
    try {
      await api("/api/collections", { method: "PATCH", json: { order: next.map((c) => c.id) } });
    } catch (e) {
      setCollections(prev);
      toast.error(t("toast.reorderFailed"), { description: (e as Error).message });
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden /> {t("new")}
        </Button>
      </div>

      {collections.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-16 text-center">
          <FolderOpen className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">{t("empty.title")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("empty.description")}</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border" data-testid="collections-list">
          {collections.map((c, i) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex flex-col">
                <Button variant="ghost" size="icon-xs" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={tc("moveUp", { name: c.name })}>
                  <ArrowUp aria-hidden />
                </Button>
                <Button variant="ghost" size="icon-xs" disabled={i === collections.length - 1} onClick={() => move(i, i + 1)} aria-label={tc("moveDown", { name: c.name })}>
                  <ArrowDown aria-hidden />
                </Button>
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/colecciones/${encodeURIComponent(c.id)}`} className="font-medium underline-offset-4 hover:underline">
                  {c.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {tc("saints", { count: c.count })}
                  {c.preview.length > 0 && ` · ${c.preview.join(", ")}${c.count > c.preview.length ? "…" : ""}`}
                </p>
              </div>
              <Button size="sm" variant="outline" asChild disabled={c.count === 0}>
                <Link href={`/crear-fichas?coleccion=${encodeURIComponent(c.id)}`}>
                  <Printer aria-hidden /> {t("printWith")}
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={tc("moreActionsFor", { name: c.name })}>
                    <MoreHorizontal aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/colecciones/${encodeURIComponent(c.id)}`}>
                      <FolderOpen aria-hidden /> {t("editMembers")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setRenaming(c)}>
                    <Pencil aria-hidden /> {tc("renameEllipsis")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(c)}>
                    <Trash2 aria-hidden /> {tc("deleteEllipsis")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <NameDialog open={creating} onOpenChange={setCreating} title={t("new")} submitLabel={tc("create")} onSubmit={create} />
      <NameDialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)} title={t("renameTitle")} initialName={renaming?.name} submitLabel={tc("save")} onSubmit={rename} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={t("delete.title", { name: deleting?.name ?? "" })}
        description={<p>{t("delete.bodyCount", { count: deleting?.count ?? 0 })}</p>}
        confirmLabel={t("delete.confirm")}
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
