"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ChevronLeft, Copy, Loader2, Plus, Printer, Save, Trash2, X } from "lucide-react";
import { ConfirmDialog } from "@/components/layout/confirm-dialog";
import { CardPreview } from "@/components/worksheets/card-preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { SaintRecord } from "@/db/repositories/saints";
import { useUnsavedGuard, UNSAVED_MESSAGE } from "@/hooks/use-unsaved-guard";
import { api, ApiError } from "@/lib/client-api";
import { ageDisplay, birthDisplay, type WorksheetSaint } from "@/lib/worksheet/card-data";
import type { WorksheetSettings } from "@/lib/worksheet/settings";
import { CharacteristicsEditor } from "./characteristics-editor";
import { PortraitEditor } from "./portrait-editor";
import { emptyForm, formToInput, recordToForm, saintFormSchema, type SaintFormValues } from "./saint-form";
import { TagInput } from "./tag-input";

type Props = {
  saint: SaintRecord | null;
  portraitUrl: string | null;
  categorySuggestions: string[];
  collectionNames: string[];
  worksheetSettings: WorksheetSettings;
  maxUploadMb: number;
};

export function SaintEditor({ saint: initial, portraitUrl: initialPortraitUrl, categorySuggestions, collectionNames, worksheetSettings, maxUploadMb }: Props) {
  const router = useRouter();
  const [record, setRecord] = useState<SaintRecord | null>(initial);
  const [portraitUrl, setPortraitUrl] = useState(initialPortraitUrl);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const isNew = !record;

  const form = useForm<SaintFormValues>({
    resolver: zodResolver(saintFormSchema),
    defaultValues: initial ? recordToForm(initial) : emptyForm(),
    mode: "onTouched",
  });
  const { register, control, handleSubmit, formState, reset, setValue, resetField } = form;
  const { errors, isDirty, isSubmitting } = formState;
  const patronages = useFieldArray({ control, name: "patronages" });
  const sources = useFieldArray({ control, name: "sources" });
  const watched = useWatch({ control }) as SaintFormValues;

  useUnsavedGuard(isDirty);

  const preview: WorksheetSaint = useMemo(() => {
    const v = watched;
    const n = (s: string) => (s?.trim() ? Number.parseInt(s, 10) : null);
    return {
      id: record?.id ?? "nuevo",
      name: v.name?.trim() || "Nombre del santo",
      birth: birthDisplay({ birthYear: n(v.birthYear), birthYearDisplay: v.birthYearDisplay ?? "" }),
      age: ageDisplay({ ageAtDeath: n(v.ageAtDeath), ageAtDeathDisplay: v.ageAtDeathDisplay ?? "" }),
      country: v.country?.trim() || "—",
      characteristics: (v.characteristics ?? []).filter((c) => c.text?.trim()).map((c) => ({ id: c.id, text: c.text })),
      portrait: portraitUrl ? { ...v.portrait, src: portraitUrl } : null,
    };
  }, [watched, portraitUrl, record?.id]);

  const onSubmit = handleSubmit(
    async (values) => {
      setSaveError(null);
      try {
        const payload = formToInput(values, record?.updatedAt);
        const { saint } = isNew
          ? await api<{ saint: SaintRecord }>("/api/saints", { method: "POST", json: payload })
          : await api<{ saint: SaintRecord }>(`/api/saints/${encodeURIComponent(record!.id)}`, { method: "PUT", json: payload });
        setRecord(saint);
        reset(recordToForm(saint));
        setSavedAt(new Date());
        toast.success(isNew ? "Santo creado" : "Cambios guardados", { description: saint.name });
        if (isNew) router.replace(`/santos/${encodeURIComponent(saint.id)}`);
        else router.refresh();
      } catch (e) {
        // Form values stay as typed so nothing is lost.
        const msg = (e as ApiError).message;
        setSaveError(msg);
        toast.error("No se pudo guardar", { description: msg });
      }
    },
    () => toast.error("Revisa los campos marcados", { description: "Hay datos que no son válidos." }),
  );

  /** Portrait upload/removal save immediately; keep the form's own edits intact. */
  const onPortraitSaved = useCallback(
    (saint: SaintRecord) => {
      setRecord(saint);
      setPortraitUrl(saint.portraitPath ? `/api/portraits/${saint.portraitPath.split("/").pop()}` : null);
      resetField("portrait", { defaultValue: { ...saint.portrait } });
      router.refresh();
    },
    [resetField, router],
  );

  async function duplicate() {
    if (!record) return;
    if (isDirty && !window.confirm(UNSAVED_MESSAGE)) return;
    try {
      const { saint } = await api<{ saint: SaintRecord }>(`/api/saints/${encodeURIComponent(record.id)}/duplicate`, { method: "POST" });
      toast.success("Copia creada", { description: saint.name });
      reset(); // clear dirty state before navigating
      router.push(`/santos/${encodeURIComponent(saint.id)}`);
    } catch (e) {
      toast.error("No se pudo duplicar", { description: (e as Error).message });
    }
  }

  async function doDelete() {
    if (!record) return;
    try {
      await api(`/api/saints/${encodeURIComponent(record.id)}`, { method: "DELETE" });
      toast.success(`«${record.name}» eliminado`);
      reset(recordToForm(record));
      router.push("/santos");
      router.refresh();
    } catch (e) {
      toast.error("No se pudo eliminar", { description: (e as Error).message });
      throw e;
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="sticky top-14 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Link href="/santos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden /> Biblioteca
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-heading text-xl font-semibold">{isNew ? "Nuevo santo" : record!.name}</h1>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {isDirty ? "Cambios sin guardar" : savedAt ? `Guardado a las ${savedAt.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}` : ""}
        </span>
        {!isNew && (
          <>
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href={`/crear-fichas?ids=${encodeURIComponent(record!.id)}`}>
                <Printer aria-hidden /> Crear ficha
              </Link>
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={duplicate}>
              <Copy aria-hidden /> Duplicar
            </Button>
            <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden /> Eliminar
            </Button>
          </>
        )}
        <Button type="button" variant="outline" size="sm" disabled={!isDirty || isSubmitting} onClick={() => reset()}>
          Descartar
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting || (!isDirty && !isNew)}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          Guardar
        </Button>
      </div>

      {saveError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle aria-hidden />
          <AlertTitle>No se guardaron los cambios</AlertTitle>
          <AlertDescription>{saveError} Tus ediciones siguen en el formulario.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,520px)]">
        <div className="space-y-8">
          {record?.reviewStatus === "needs_review" && (
            <Alert className="border-warning/40 bg-warning/10 text-warning-foreground">
              <AlertTriangle aria-hidden />
              <AlertTitle>Pendiente de revisión histórica</AlertTitle>
              <AlertDescription className="text-warning-foreground">
                <p>Los datos importados no han sido verificados. Cuando compruebes fechas, edad, país y características con una fuente confiable, márcalo como revisado.</p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="mt-2"
                  disabled={isSubmitting}
                  onClick={() => {
                    setValue("reviewStatus", "reviewed", { shouldDirty: true });
                    void onSubmit();
                  }}
                >
                  <CheckCircle2 aria-hidden />
                  {isDirty ? "Marcar como revisado y guardar cambios" : "Marcar como revisado"}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Section title="Datos básicos">
            <Field label="Nombre" htmlFor="name" error={errors.name?.message} required>
              <Input id="name" {...register("name")} aria-invalid={!!errors.name} autoComplete="off" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Año de nacimiento (número)" htmlFor="birthYear" error={errors.birthYear?.message} hint="Vacío si se desconoce.">
                <Input id="birthYear" inputMode="numeric" {...register("birthYear")} aria-invalid={!!errors.birthYear} />
              </Field>
              <Field label="Año de nacimiento (texto mostrado)" htmlFor="birthYearDisplay" hint="Se imprime tal cual: «aprox. 1181–1182».">
                <Input id="birthYearDisplay" {...register("birthYearDisplay")} />
              </Field>
              <Field label="Edad al morir (número)" htmlFor="ageAtDeath" error={errors.ageAtDeath?.message}>
                <Input id="ageAtDeath" inputMode="numeric" {...register("ageAtDeath")} aria-invalid={!!errors.ageAtDeath} />
              </Field>
              <Field label="Edad al morir (texto mostrado)" htmlFor="ageAtDeathDisplay" hint="Ej.: «14 años», «aprox. 13–14 años».">
                <Input id="ageAtDeathDisplay" {...register("ageAtDeathDisplay")} />
              </Field>
              <Field label="País de origen" htmlFor="country">
                <Input id="country" {...register("country")} />
              </Field>
              <Field label="Año de canonización" htmlFor="canonizationYear" error={errors.canonizationYear?.message} hint="Opcional. Si está vacío no se muestra.">
                <Input id="canonizationYear" inputMode="numeric" {...register("canonizationYear")} aria-invalid={!!errors.canonizationYear} />
              </Field>
            </div>
          </Section>

          <Section title="Características" description="Lista ordenada que se imprime como viñetas. Arrastra o usa las flechas para reordenar.">
            <CharacteristicsEditor control={control} register={register} errors={errors} />
          </Section>

          <Section title="Clasificación">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Estado de revisión" htmlFor="reviewStatus">
                <Controller
                  control={control}
                  name="reviewStatus"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="reviewStatus" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="needs_review">Pendiente de revisión</SelectItem>
                        <SelectItem value="reviewed">Revisado</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <div className="flex items-center gap-3 pt-6">
                <Controller control={control} name="isMartyr" render={({ field }) => <Switch id="isMartyr" checked={field.value} onCheckedChange={field.onChange} />} />
                <Label htmlFor="isMartyr">Mártir</Label>
              </div>
            </div>
            <Field label="Categorías" htmlFor="categories">
              <Controller
                control={control}
                name="categories"
                render={({ field }) => <TagInput id="categories" value={field.value} onChange={field.onChange} suggestions={categorySuggestions} placeholder="Escribe y pulsa Enter" />}
              />
            </Field>
            {collectionNames.length > 0 && (
              <p className="text-xs text-muted-foreground">En colecciones: {collectionNames.join(" · ")}</p>
            )}
            <ListField
              label="Patronazgos"
              items={patronages.fields}
              register={(i) => register(`patronages.${i}.value`)}
              errors={(i) => errors.patronages?.[i]?.value?.message}
              onAdd={() => patronages.append({ value: "" })}
              onRemove={patronages.remove}
              addLabel="Añadir patronazgo"
            />
          </Section>

          <Section title="Fuentes" description="Referencias para la revisión histórica (opcional). No se imprimen.">
            <ListField
              label="Fuentes"
              hideLabel
              items={sources.fields}
              register={(i) => register(`sources.${i}.value`)}
              errors={(i) => errors.sources?.[i]?.value?.message}
              onAdd={() => sources.append({ value: "" })}
              onRemove={sources.remove}
              addLabel="Añadir fuente"
              placeholder="URL o referencia bibliográfica"
            />
          </Section>
        </div>

        {/* Right column: portrait + live card preview */}
        <aside className="space-y-6 lg:sticky lg:top-32 lg:self-start">
          <Section title="Retrato">
            <PortraitEditor
              saintId={record?.id ?? null}
              portraitUrl={portraitUrl}
              settings={watched.portrait ?? { focalX: 50, focalY: 50, zoom: 1, fit: "cover" }}
              onSettingsChange={(p) => setValue("portrait", p, { shouldDirty: true })}
              onSaved={onPortraitSaved}
              maxUploadMb={maxUploadMb}
            />
          </Section>
          <Section title="Vista previa de la ficha" description="Mismo diseño que la impresión, a tamaño real de media página.">
            <CardPreview saint={preview} settings={{ ...worksheetSettings, perPage: 2 }} onOverflowChange={setOverflow} />
            {overflow && (
              <p className="mt-2 text-xs text-destructive" role="status">
                Con la configuración actual ({worksheetSettings.fontSizePt} pt) esta ficha no cabe en media página. Acorta el texto, o en Crear Fichas reduce la letra o usa una ficha por página.
              </p>
            )}
          </Section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`¿Eliminar a ${record?.name ?? ""}?`}
        description={
          <>
            <p>Se borrarán sus características{collectionNames.length ? ` y se quitará de ${collectionNames.length} colección(es)` : ""}.</p>
            <p className="font-medium text-foreground">Esta acción no se puede deshacer.</p>
          </>
        }
        confirmLabel="Eliminar"
        destructive
        onConfirm={doDelete}
      />
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, htmlFor, error, hint, required, children }: { label: string; htmlFor: string; error?: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>
        {label}
        {required && <span className="text-destructive" aria-hidden> *</span>}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function ListField(props: {
  label: string;
  hideLabel?: boolean;
  items: { id: string }[];
  register: (i: number) => ReturnType<ReturnType<typeof useForm<SaintFormValues>>["register"]>;
  errors: (i: number) => string | undefined;
  onAdd: () => void;
  onRemove: (i: number) => void;
  addLabel: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      {!props.hideLabel && <p className="text-sm font-medium">{props.label}</p>}
      {props.items.map((item, i) => (
        <div key={item.id}>
          <div className="flex gap-2">
            <Input {...props.register(i)} placeholder={props.placeholder} aria-label={`${props.label} ${i + 1}`} aria-invalid={!!props.errors(i)} />
            <Button type="button" variant="ghost" size="icon" onClick={() => props.onRemove(i)} aria-label={`Quitar ${props.label.toLowerCase()} ${i + 1}`}>
              <X aria-hidden />
            </Button>
          </div>
          {props.errors(i) && <p className="mt-1 text-xs text-destructive">{props.errors(i)}</p>}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={props.onAdd}>
        <Plus aria-hidden /> {props.addLabel}
      </Button>
    </div>
  );
}
