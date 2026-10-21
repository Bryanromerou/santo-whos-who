"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, FolderOpen, MoreHorizontal, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/client-api";
import { pluralize } from "@/lib/text";
import { moveItem } from "@/lib/worksheet/paginate";
import { NameDialog } from "./name-dialog";

export type CollectionCard = { id: string; name: string; count: number; preview: string[] };

export function CollectionsManager({ collections: initial }: { collections: CollectionCard[] }) {
  const router = useRouter();
  const [collections, setCollections] = useState(initial);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<CollectionCard | null>(null);
  const [deleting, setDeleting] = useState<CollectionCard | null>(null);

  async function create(name: string) {
    const { collection } = await api<{ collection: { id: string; name: string } }>("/api/collections", { method: "POST", json: { name } });
    toast.success(`Colección «${collection.name}» creada`);
    router.push(`/colecciones/${encodeURIComponent(collection.id)}`);
  }

  async function rename(name: string) {
    if (!renaming) return;
    await api(`/api/collections/${encodeURIComponent(renaming.id)}`, { method: "PATCH", json: { name } });
    setCollections((cs) => cs.map((c) => (c.id === renaming.id ? { ...c, name } : c)));
    toast.success("Colección renombrada");
    router.refresh();
  }

  async function remove() {
    if (!deleting) return;
    try {
      await api(`/api/collections/${encodeURIComponent(deleting.id)}`, { method: "DELETE" });
      setCollections((cs) => cs.filter((c) => c.id !== deleting.id));
      toast.success(`Colección «${deleting.name}» eliminada`, { description: "Los santos siguen en la biblioteca." });
      router.refresh();
    } catch (e) {
      toast.error("No se pudo eliminar", { description: (e as Error).message });
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
      toast.error("No se pudo reordenar", { description: (e as Error).message });
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">Colecciones</h1>
          <p className="mt-1 text-sm text-muted-foreground">Grupos de santos para preparar fichas. Editar un santo actualiza todas sus colecciones.</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden /> Nueva colección
        </Button>
      </div>

      {collections.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-16 text-center">
          <FolderOpen className="mx-auto size-8 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">Todavía no hay colecciones</p>
          <p className="mt-1 text-sm text-muted-foreground">Crea una, o importa tu archivo JSON: trae las colecciones preparadas.</p>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border" data-testid="collections-list">
          {collections.map((c, i) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="flex flex-col">
                <Button variant="ghost" size="icon-xs" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Subir ${c.name}`}>
                  <ArrowUp aria-hidden />
                </Button>
                <Button variant="ghost" size="icon-xs" disabled={i === collections.length - 1} onClick={() => move(i, i + 1)} aria-label={`Bajar ${c.name}`}>
                  <ArrowDown aria-hidden />
                </Button>
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/colecciones/${encodeURIComponent(c.id)}`} className="font-medium underline-offset-4 hover:underline">
                  {c.name}
                </Link>
                <p className="truncate text-xs text-muted-foreground">
                  {pluralize(c.count, "santo", "santos")}
                  {c.preview.length > 0 && ` · ${c.preview.join(", ")}${c.count > c.preview.length ? "…" : ""}`}
                </p>
              </div>
              <Button size="sm" variant="outline" asChild disabled={c.count === 0}>
                <Link href={`/crear-fichas?coleccion=${encodeURIComponent(c.id)}`}>
                  <Printer aria-hidden /> Crear fichas con esta colección
                </Link>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Más acciones para ${c.name}`}>
                    <MoreHorizontal aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link href={`/colecciones/${encodeURIComponent(c.id)}`}>
                      <FolderOpen aria-hidden /> Editar santos y orden
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => setRenaming(c)}>
                    <Pencil aria-hidden /> Renombrar…
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(c)}>
                    <Trash2 aria-hidden /> Eliminar…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      <NameDialog open={creating} onOpenChange={setCreating} title="Nueva colección" submitLabel="Crear" onSubmit={create} />
      <NameDialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)} title="Renombrar colección" initialName={renaming?.name} submitLabel="Guardar" onSubmit={rename} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`¿Eliminar la colección «${deleting?.name ?? ""}»?`}
        description={<p>Solo se borra la colección. Sus {deleting?.count ?? 0} santos siguen en la biblioteca.</p>}
        confirmLabel="Eliminar colección"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}
