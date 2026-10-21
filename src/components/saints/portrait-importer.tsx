"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, CircleSlash, Copy, FolderOpen, ImagePlus, Loader2, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/client-api";
import { duplicateGroups, fileBaseName, fileExtension, isImageFileName, matchFile, type FileMatch } from "@/lib/portrait-matching";
import { cn } from "@/lib/utils";

type SaintOption = { id: string; name: string; thumb: string | null };
type Status = "pending" | "uploading" | "done" | "error";

type Item = {
  key: string;
  file: File;
  url: string;
  hash: string;
  match: FileMatch;
  /** Current assignment (starts as the best match for exact/fuzzy). */
  saintId: string | null;
  /** Exact matches and manual assignments are accepted; fuzzy ones need confirmation. */
  accepted: boolean;
  /** Fuzzy matches the user has decided on (accepted or skipped) in the review modal. */
  reviewed: boolean;
  identicalTo?: string;
  status: Status;
  error?: string;
};

const NONE = "__none__";
const DIRECT_TYPES = ["jpg", "jpeg", "png", "webp"];

async function sha256(file: File): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** GIF/AVIF/BMP or files over the size limit are converted in the browser to a JPEG (max 3000 px). */
async function prepareForUpload(file: File, maxBytes: number, errors: { unreadable: string; convertFailed: string }): Promise<File> {
  if (DIRECT_TYPES.includes(fileExtension(file.name)) && file.size <= maxBytes) return file;
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error(errors.unreadable);
  }
  const scale = Math.min(1, 3000 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.92));
  if (!blob) throw new Error(errors.convertFailed);
  return new File([blob], `${fileBaseName(file.name)}.jpg`, { type: "image/jpeg" });
}

/** Reads files from a dropped folder (recursively). */
async function filesFromDrop(dt: DataTransfer): Promise<File[]> {
  const entries = Array.from(dt.items)
    .map((i) => i.webkitGetAsEntry?.())
    .filter((e): e is FileSystemEntry => !!e);
  if (!entries.length) return Array.from(dt.files);
  const out: File[] = [];
  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      out.push(await new Promise<File>((res, rej) => (entry as FileSystemFileEntry).file(res, rej)));
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      let batch: FileSystemEntry[];
      do {
        batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
        for (const e of batch) await walk(e);
      } while (batch.length);
    }
  };
  for (const e of entries) await walk(e);
  return out;
}

export function PortraitImporter({ saints, maxUploadBytes }: { saints: SaintOption[]; maxUploadBytes: number }) {
  const router = useRouter();
  const t = useTranslations("portraits.importer");
  const folderRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [dupChoice, setDupChoice] = useState<Record<string, string | null>>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const byId = useMemo(() => new Map(saints.map((s) => [s.id, s])), [saints]);

  // Preview URLs are revoked on a new scan (in scan) and when leaving the page.
  const urlsRef = useRef<string[]>([]);
  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  /* ---------- derived state ---------- */
  // Files competing for the same saint: accepted ones plus fuzzy candidates still awaiting review.
  const groups = useMemo(
    () => duplicateGroups(items.filter((i) => i.saintId && (i.accepted || (i.match.kind === "fuzzy" && !i.reviewed)))),
    [items],
  );
  const fuzzyPending = items.filter((i) => i.match.kind === "fuzzy" && !i.reviewed && !(i.saintId && groups.has(i.saintId)));
  const unresolvedGroups = [...groups.keys()].filter((sid) => !(sid in dupChoice));
  const needsReview = fuzzyPending.length + unresolvedGroups.length;

  const isChosen = (i: Item) => {
    if (!i.saintId || !i.accepted) return false;
    if (groups.has(i.saintId)) return dupChoice[i.saintId] === i.key;
    return true;
  };
  const willImport = (i: Item) => isChosen(i) && (replaceExisting || !byId.get(i.saintId!)?.thumb) && i.status !== "done";
  const toImport = items.filter(willImport);
  const existingSkipped = items.filter((i) => isChosen(i) && !replaceExisting && byId.get(i.saintId!)?.thumb).length;

  /* ---------- scanning ---------- */
  async function scan(files: File[]) {
    setScanning(true);
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    try {
      const visible = files.filter((f) => !f.name.startsWith("."));
      const images = visible.filter((f) => isImageFileName(f.name));
      setIgnored(visible.filter((f) => !isImageFileName(f.name)).map((f) => f.name));
      const seen = new Map<string, string>();
      const next: Item[] = [];
      for (const [n, file] of images.sort((a, b) => a.name.localeCompare(b.name, "es")).entries()) {
        const hash = await sha256(file);
        const match = matchFile(file.name, saints);
        next.push({
          key: `${n}:${file.name}`,
          file,
          url: (() => {
            const u = URL.createObjectURL(file);
            urlsRef.current.push(u);
            return u;
          })(),
          hash,
          match,
          saintId: match.saintId,
          accepted: match.kind === "exact",
          reviewed: match.kind !== "fuzzy",
          identicalTo: seen.get(hash),
          status: "pending",
        });
        if (!seen.has(hash)) seen.set(hash, file.name);
      }
      setItems(next);
      setDupChoice({});
      const g = duplicateGroups(next.filter((i) => i.saintId && (i.accepted || i.match.kind === "fuzzy")));
      if (g.size || next.some((i) => i.match.kind === "fuzzy")) setReviewOpen(true);
      if (!next.length) toast.error(t("noImages"), { description: t("supportedFormats") });
    } finally {
      setScanning(false);
    }
  }

  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  /** Manual assignment from the table (or the modal). */
  function assign(key: string, saintId: string | null) {
    const old = items.find((i) => i.key === key)?.saintId;
    update(key, { saintId, accepted: !!saintId, reviewed: true });
    // Re-open duplicate decisions that this change affects.
    setDupChoice((c) => {
      const next = { ...c };
      if (old) delete next[old];
      if (saintId) delete next[saintId];
      return next;
    });
  }

  /* ---------- upload ---------- */
  async function runImport() {
    if (needsReview > 0) {
      setReviewOpen(true);
      return;
    }
    setUploading(true);
    let ok = 0;
    let failed = 0;
    for (const item of toImport) {
      update(item.key, { status: "uploading", error: undefined });
      try {
        const file = await prepareForUpload(item.file, maxUploadBytes, { unreadable: t("unreadable"), convertFailed: t("convertFailed") });
        const body = new FormData();
        body.append("file", file);
        await api(`/api/saints/${encodeURIComponent(item.saintId!)}/portrait`, { method: "POST", body });
        update(item.key, { status: "done" });
        ok++;
      } catch (e) {
        update(item.key, { status: "error", error: (e as Error).message });
        failed++;
      }
    }
    setUploading(false);
    router.refresh();
    if (failed) toast.warning(t("importedWithErrors", { count: ok, failed }), { description: t("checkErrors") });
    else toast.success(t("imported", { count: ok }));
  }

  const done = items.filter((i) => i.status === "done").length;
  const counts = {
    exact: items.filter((i) => i.match.kind === "exact").length,
    fuzzy: items.filter((i) => i.match.kind === "fuzzy").length,
    none: items.filter((i) => i.match.kind === "none").length,
  };

  return (
    <div className="space-y-6">
      {/* Picker */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDragOver(false);
          void scan(await filesFromDrop(e.dataTransfer));
        }}
        className={cn("flex flex-col items-center gap-3 rounded-lg border border-dashed px-6 py-8 text-center", dragOver && "border-primary bg-muted/50")}
      >
        <ImagePlus className="size-8 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">{t("dropHint")}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="outline" onClick={() => folderRef.current?.click()} disabled={scanning || uploading}>
            <FolderOpen aria-hidden /> {t("chooseFolder")}
          </Button>
          <Button variant="outline" onClick={() => filesRef.current?.click()} disabled={scanning || uploading}>
            <ImagePlus aria-hidden /> {t("chooseImages")}
          </Button>
        </div>
        {scanning && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> {t("scanning")}
          </p>
        )}
        <input
          ref={folderRef}
          type="file"
          className="sr-only"
          multiple
          {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
          onChange={(e) => {
            void scan(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <input
          ref={filesRef}
          type="file"
          className="sr-only"
          multiple
          accept="image/*"
          data-testid="portraits-files-input"
          onChange={(e) => {
            void scan(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {items.length > 0 && (
        <>
          {/* Summary + actions */}
          <div className="flex flex-wrap items-center gap-2 text-sm" data-testid="portrait-summary">
            <Badge variant="secondary">{t("summary.exact", { count: counts.exact })}</Badge>
            {counts.fuzzy > 0 && <Badge variant="outline">{t("summary.fuzzy", { count: counts.fuzzy })}</Badge>}
            {counts.none > 0 && <Badge variant="outline">{t("summary.none", { count: counts.none })}</Badge>}
            {groups.size > 0 && <Badge variant="outline">{t("summary.groups", { count: groups.size })}</Badge>}
            {ignored.length > 0 && (
              <span className="text-xs text-muted-foreground" title={ignored.join("\n")}>
                {t("summary.ignored", { count: ignored.length })}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2">
              <Switch id="replace-existing" checked={replaceExisting} onCheckedChange={setReplaceExisting} disabled={uploading} />
              <Label htmlFor="replace-existing" className="font-normal">
                {t("replaceExisting")}
              </Label>
            </div>
            {existingSkipped > 0 && !replaceExisting && (
              <span className="text-xs text-muted-foreground">{t("existingSkipped", { count: existingSkipped })}</span>
            )}
            <div className="ml-auto flex flex-wrap gap-2">
              {needsReview > 0 && (
                <Button variant="outline" onClick={() => setReviewOpen(true)}>
                  <AlertTriangle aria-hidden /> {t("reviewCount", { count: needsReview })}
                </Button>
              )}
              <Button onClick={runImport} disabled={uploading || needsReview > 0 || toImport.length === 0}>
                {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <ImagePlus aria-hidden />}
                {uploading ? t("importing", { done, total: done + toImport.length }) : t("importButton", { count: toImport.length })}
              </Button>
            </div>
          </div>

          {done > 0 && !uploading && (
            <Alert className="border-success/40 bg-success/10">
              <CheckCircle2 className="text-success-foreground" aria-hidden />
              <AlertTitle className="text-success-foreground">{t("imported", { count: done })}</AlertTitle>
              <AlertDescription>
                <Link href="/santos" className="underline underline-offset-4">
                  {t("viewLibrary")}
                </Link>
              </AlertDescription>
            </Alert>
          )}

          {/* Item list */}
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-14">
                    <span className="sr-only">{t("columns.preview")}</span>
                  </TableHead>
                  <TableHead>{t("columns.file")}</TableHead>
                  <TableHead className="w-[300px]">{t("columns.saint")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => {
                  const saint = i.saintId ? byId.get(i.saintId) : undefined;
                  return (
                    <TableRow key={i.key} data-testid="portrait-item" className={cn(!willImport(i) && i.status !== "done" && "opacity-60")}>
                      <TableCell className="py-1.5">
                        {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                        <img src={i.url} alt="" className="h-12 w-9 rounded-sm border object-cover" />
                      </TableCell>
                      <TableCell className="max-w-[280px] whitespace-normal">
                        <span className="text-sm">{i.file.name}</span>
                        {i.identicalTo && (
                          <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <Copy className="size-3" aria-hidden /> {t("identicalTo", { name: i.identicalTo })}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select value={i.saintId ?? NONE} onValueChange={(v) => assign(i.key, v === NONE ? null : v)} disabled={uploading || i.status === "done"}>
                          <SelectTrigger size="sm" className="w-full" aria-label={t("saintFor", { file: i.file.name })}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={NONE}>{t("unassigned")}</SelectItem>
                            {saints.map((s) => (
                              <SelectItem key={s.id} value={s.id}>
                                {s.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="whitespace-normal">
                        <ItemStatus item={i} saint={saint} chosen={isChosen(i)} inGroup={!!i.saintId && groups.has(i.saintId)} replaceExisting={replaceExisting} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <ReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        items={items}
        groups={groups}
        dupChoice={dupChoice}
        saints={saints}
        byId={byId}
        onApply={(decisions, choices) => {
          setItems((list) =>
            list.map((i) => {
              const d = decisions[i.key];
              if (!d) return i;
              return d.accept ? { ...i, saintId: d.saintId, accepted: true, reviewed: true } : { ...i, accepted: false, reviewed: true };
            }),
          );
          setDupChoice((c) => ({ ...c, ...choices }));
          setReviewOpen(false);
        }}
      />
    </div>
  );
}

function ItemStatus({ item, saint, chosen, inGroup, replaceExisting }: { item: Item; saint?: SaintOption; chosen: boolean; inGroup: boolean; replaceExisting: boolean }) {
  const t = useTranslations("portraits.importer.status");
  if (item.status === "uploading") return <span className="flex items-center gap-1 text-xs"><Loader2 className="size-3 animate-spin" aria-hidden /> {t("uploading")}</span>;
  if (item.status === "done") return <span className="flex items-center gap-1 text-xs text-success-foreground"><CheckCircle2 className="size-3.5" aria-hidden /> {t("done")}</span>;
  if (item.status === "error") return <span className="flex items-start gap-1 text-xs text-destructive"><XCircle className="mt-px size-3.5 shrink-0" aria-hidden /> {item.error}</span>;
  if (!item.saintId) return <span className="text-xs text-muted-foreground">{t("noMatch")}</span>;
  if (item.match.kind === "fuzzy" && !item.reviewed) return <span className="text-xs text-warning-foreground">{t("fuzzy", { percent: Math.round(item.match.score * 100) })}</span>;
  if (inGroup && !chosen) return <span className="flex items-center gap-1 text-xs text-muted-foreground"><CircleSlash className="size-3.5" aria-hidden /> {t("otherChosen")}</span>;
  if (!item.accepted) return <span className="flex items-center gap-1 text-xs text-muted-foreground"><CircleSlash className="size-3.5" aria-hidden /> {t("skipped")}</span>;
  if (saint?.thumb && !replaceExisting) return <span className="text-xs text-muted-foreground">{t("hasPortrait")}</span>;
  const label = item.match.kind === "exact" && item.saintId === item.match.saintId ? t("exact") : t("assigned");
  return <span className="flex items-center gap-1 text-xs text-success-foreground"><CheckCircle2 className="size-3.5" aria-hidden /> {label}{saint?.thumb ? t("willReplace") : ""}</span>;
}

/* ------------------------------------------------------------------ */
/* Review modal: near matches (≈80 %) and several images per saint      */
/* ------------------------------------------------------------------ */

type Decision = { accept: boolean; saintId: string | null };

function ReviewDialog(props: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: Item[];
  groups: Map<string, string[]>;
  dupChoice: Record<string, string | null>;
  saints: SaintOption[];
  byId: Map<string, SaintOption>;
  onApply: (decisions: Record<string, Decision>, choices: Record<string, string | null>) => void;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">{props.open && <ReviewForm {...props} />}</DialogContent>
    </Dialog>
  );
}

function ReviewForm({ items, groups, dupChoice, saints, byId, onApply, onOpenChange }: Parameters<typeof ReviewDialog>[0]) {
  const t = useTranslations("portraits.review");
  const tc = useTranslations("common");
  const itemByKey = new Map(items.map((i) => [i.key, i]));
  const fuzzy = items.filter((i) => i.match.kind === "fuzzy" && !(i.saintId && groups.has(i.saintId)));
  const [decisions, setDecisions] = useState<Record<string, Decision>>(() =>
    Object.fromEntries(fuzzy.map((i) => [i.key, { accept: i.reviewed ? i.accepted : true, saintId: i.saintId }])),
  );
  // Default choice per duplicate group: keep a previous choice, else prefer the exact match.
  const [choices, setChoices] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(
      [...groups].map(([sid, keys]) => {
        if (sid in dupChoice) return [sid, dupChoice[sid]];
        const exact = keys.find((k) => itemByKey.get(k)?.match.kind === "exact");
        return [sid, exact ?? keys[0]];
      }),
    ),
  );

  const apply = () => {
    const all: Record<string, Decision> = { ...decisions };
    // Files in duplicate groups: the chosen one is accepted (this confirms fuzzy ones too).
    for (const [sid, keys] of groups) {
      for (const k of keys) {
        const item = itemByKey.get(k)!;
        if (choices[sid] === k) all[k] = { accept: true, saintId: sid };
        else if (item.match.kind === "fuzzy" && !item.reviewed) all[k] = { accept: false, saintId: item.saintId };
      }
    }
    onApply(all, choices);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("description")}</DialogDescription>
      </DialogHeader>

      {groups.size > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{t("groupsTitle")}</h3>
          {[...groups].map(([sid, keys]) => (
            <div key={sid} className="rounded-lg border p-3" data-testid="duplicate-group">
              <p className="mb-2 text-sm font-medium">{byId.get(sid)?.name ?? sid}</p>
              <RadioGroup value={choices[sid] ?? NONE} onValueChange={(v) => setChoices((c) => ({ ...c, [sid]: v === NONE ? null : v }))} className="gap-2">
                {keys.map((k) => {
                  const it = itemByKey.get(k)!;
                  return (
                    <Label key={k} htmlFor={`dup-${k}`} className="flex cursor-pointer items-center gap-3 rounded-md border p-2 font-normal">
                      <RadioGroupItem id={`dup-${k}`} value={k} />
                      {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                      <img src={it.url} alt="" className="h-16 w-12 rounded-sm border object-cover" />
                      <span className="min-w-0 flex-1 text-sm">
                        {it.file.name}
                        <span className="block text-xs text-muted-foreground">
                          {it.match.kind === "exact" ? t("exactName") : t("similarName", { percent: Math.round(it.match.score * 100) })} · {t("kb", { kb: Math.round(it.file.size / 1024) })}
                          {it.identicalTo ? ` · ${t("identicalTo", { name: it.identicalTo })}` : ""}
                        </span>
                      </span>
                    </Label>
                  );
                })}
                <Label htmlFor={`dup-${sid}-none`} className="flex cursor-pointer items-center gap-3 rounded-md border p-2 font-normal">
                  <RadioGroupItem id={`dup-${sid}-none`} value={NONE} />
                  <span className="text-sm text-muted-foreground">{t("none")}</span>
                </Label>
              </RadioGroup>
            </div>
          ))}
        </section>
      )}

      {fuzzy.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">{t("fuzzyTitle")}</h3>
          {fuzzy.map((i) => {
            const d = decisions[i.key];
            const options = [i.match.saintId, ...i.match.alternatives.map((a) => a.saintId)].filter((x, n, arr): x is string => !!x && arr.indexOf(x) === n);
            return (
              <div key={i.key} className="flex flex-wrap items-center gap-3 rounded-lg border p-3" data-testid="fuzzy-item">
                {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                <img src={i.url} alt="" className="h-16 w-12 rounded-sm border object-cover" />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm">
                    {t.rich("fuzzyQuestion", { file: i.file.name, saint: byId.get(i.match.saintId!)?.name ?? "", strong: (chunks) => <strong>{chunks}</strong> })}{" "}
                    <span className="text-xs text-muted-foreground">{t("similarity", { percent: Math.round(i.match.score * 100) })}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={d.accept ? (d.saintId ?? NONE) : NONE}
                      onValueChange={(v) => setDecisions((s) => ({ ...s, [i.key]: v === NONE ? { accept: false, saintId: d.saintId } : { accept: true, saintId: v } }))}
                    >
                      <SelectTrigger size="sm" className="w-[280px]" aria-label={t("assignFile", { file: i.file.name })}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t("skipImage")}</SelectItem>
                        {options.map((id) => (
                          <SelectItem key={id} value={id}>
                            {t("assignTo", { name: byId.get(id)?.name ?? id })}
                          </SelectItem>
                        ))}
                        {saints
                          .filter((s) => !options.includes(s.id))
                          .map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {groups.size === 0 && fuzzy.length === 0 && <p className="text-sm text-muted-foreground">{t("nothing")}</p>}

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {tc("cancel")}
        </Button>
        <Button onClick={apply}>{tc("confirm")}</Button>
      </DialogFooter>
    </>
  );
}
