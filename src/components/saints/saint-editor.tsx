"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
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
import { useUnsavedGuard, useUnsavedMessage } from "@/hooks/use-unsaved-guard";
import { loose } from "@/i18n/loose";
import { zodErrorMap } from "@/i18n/zod";
import { api, ApiError } from "@/lib/client-api";
import { ageDisplay, birthDisplay, type WorksheetSaint } from "@/lib/worksheet/card-data";
import type { WorksheetSettings } from "@/lib/worksheet/settings";
import { CharacteristicsEditor } from "./characteristics-editor";
import { PortraitEditor } from "./portrait-editor";
import { buildSaintFormSchema, emptyForm, formToInput, recordToForm, type SaintFormValues } from "./saint-form";
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
  const t = useTranslations("editor");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const tb = useTranslations("builder");
  const locale = useLocale();
  const unsavedMessage = useUnsavedMessage();
  const formSchema = useMemo(() => buildSaintFormSchema(loose(tv)), [tv]);
  const [record, setRecord] = useState<SaintRecord | null>(initial);
  const [portraitUrl, setPortraitUrl] = useState(initialPortraitUrl);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const isNew = !record;

  const form = useForm<SaintFormValues>({
    resolver: zodResolver(formSchema, { error: zodErrorMap(locale) }),
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
        toast.success(isNew ? t("toast.created") : t("toast.saved"), { description: saint.name });
        if (isNew) router.replace(`/santos/${encodeURIComponent(saint.id)}`);
        else router.refresh();
      } catch (e) {
        // Form values stay as typed so nothing is lost.
        const msg = (e as ApiError).message;
        setSaveError(msg);
        toast.error(t("toast.saveFailed"), { description: msg });
      }
    },
    () => toast.error(t("toast.checkFields"), { description: t("toast.invalidData") }),
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
    if (isDirty && !window.confirm(unsavedMessage)) return;
    try {
      const { saint } = await api<{ saint: SaintRecord }>(`/api/saints/${encodeURIComponent(record.id)}/duplicate`, { method: "POST" });
      toast.success(t("toast.copyCreated"), { description: saint.name });
      reset(); // clear dirty state before navigating
      router.push(`/santos/${encodeURIComponent(saint.id)}`);
    } catch (e) {
      toast.error(t("toast.duplicateFailed"), { description: (e as Error).message });
    }
  }

  async function doDelete() {
    if (!record) return;
    try {
      await api(`/api/saints/${encodeURIComponent(record.id)}`, { method: "DELETE" });
      toast.success(t("toast.deleted", { name: record.name }));
      reset(recordToForm(record));
      router.push("/santos");
      router.refresh();
    } catch (e) {
      toast.error(t("toast.deleteFailed"), { description: (e as Error).message });
      throw e;
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="sticky top-14 z-20 -mx-4 mb-6 flex flex-wrap items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <Link href="/santos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" aria-hidden /> {tc("library")}
        </Link>
        <h1 className="min-w-0 flex-1 truncate font-heading text-xl font-semibold">{isNew ? t("newSaint") : record!.name}</h1>
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {isDirty ? t("unsaved") : savedAt ? t("savedAt", { time: savedAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }) }) : ""}
        </span>
        {!isNew && (
          <>
            <Button type="button" variant="ghost" size="sm" asChild>
              <Link href={`/crear-fichas?ids=${encodeURIComponent(record!.id)}`}>
                <Printer aria-hidden /> {tc("printWorksheet")}
              </Link>
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={duplicate}>
              <Copy aria-hidden /> {tc("duplicate")}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden /> {tc("delete")}
            </Button>
          </>
        )}
        <Button type="button" variant="outline" size="sm" disabled={!isDirty || isSubmitting} onClick={() => reset()}>
          {t("discard")}
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting || (!isDirty && !isNew)}>
          {isSubmitting ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />}
          {tc("save")}
        </Button>
      </div>

      {saveError && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle aria-hidden />
          <AlertTitle>{t("saveErrorTitle")}</AlertTitle>
          <AlertDescription>
            {saveError} {t("saveErrorKept")}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(340px,520px)]">
        <div className="space-y-8">
          {record?.reviewStatus === "needs_review" && (
            <Alert className="border-warning/40 bg-warning/10 text-warning-foreground">
              <AlertTriangle aria-hidden />
              <AlertTitle>{t("review.title")}</AlertTitle>
              <AlertDescription className="text-warning-foreground">
                <p>{t("review.body")}</p>
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
                  {isDirty ? t("review.markAndSave") : t("review.mark")}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <Section title={t("sections.basics")}>
            <Field label={t("fields.name")} htmlFor="name" error={errors.name?.message} required>
              <Input id="name" {...register("name")} aria-invalid={!!errors.name} autoComplete="off" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("fields.birthYear")} htmlFor="birthYear" error={errors.birthYear?.message} hint={t("hints.birthYear")}>
                <Input id="birthYear" inputMode="numeric" {...register("birthYear")} aria-invalid={!!errors.birthYear} />
              </Field>
              <Field label={t("fields.birthYearDisplay")} htmlFor="birthYearDisplay" hint={t("hints.birthYearDisplay")}>
                <Input id="birthYearDisplay" {...register("birthYearDisplay")} />
              </Field>
              <Field label={t("fields.ageAtDeath")} htmlFor="ageAtDeath" error={errors.ageAtDeath?.message}>
                <Input id="ageAtDeath" inputMode="numeric" {...register("ageAtDeath")} aria-invalid={!!errors.ageAtDeath} />
              </Field>
              <Field label={t("fields.ageAtDeathDisplay")} htmlFor="ageAtDeathDisplay" hint={t("hints.ageAtDeathDisplay")}>
                <Input id="ageAtDeathDisplay" {...register("ageAtDeathDisplay")} />
              </Field>
              <Field label={t("fields.country")} htmlFor="country">
                <Input id="country" {...register("country")} />
              </Field>
              <Field label={t("fields.canonizationYear")} htmlFor="canonizationYear" error={errors.canonizationYear?.message} hint={t("hints.canonizationYear")}>
                <Input id="canonizationYear" inputMode="numeric" {...register("canonizationYear")} aria-invalid={!!errors.canonizationYear} />
              </Field>
            </div>
          </Section>

          <Section title={t("sections.characteristics")} description={t("sections.characteristicsHelp")}>
            <CharacteristicsEditor control={control} register={register} errors={errors} />
          </Section>

          <Section title={t("sections.classification")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("fields.reviewStatus")} htmlFor="reviewStatus">
                <Controller
                  control={control}
                  name="reviewStatus"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="reviewStatus" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="needs_review">{t("reviewStatus.needs_review")}</SelectItem>
                        <SelectItem value="reviewed">{t("reviewStatus.reviewed")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
              <div className="flex items-center gap-3 pt-6">
                <Controller control={control} name="isMartyr" render={({ field }) => <Switch id="isMartyr" checked={field.value} onCheckedChange={field.onChange} />} />
                <Label htmlFor="isMartyr">{t("fields.isMartyr")}</Label>
              </div>
            </div>
            <Field label={t("fields.categories")} htmlFor="categories">
              <Controller
                control={control}
                name="categories"
                render={({ field }) => <TagInput id="categories" value={field.value} onChange={field.onChange} suggestions={categorySuggestions} placeholder={t("hints.categories")} />}
              />
            </Field>
            {collectionNames.length > 0 && (
              <p className="text-xs text-muted-foreground">{t("inCollections", { names: collectionNames.join(" · ") })}</p>
            )}
            <ListField
              label={t("fields.patronages")}
              items={patronages.fields}
              register={(i) => register(`patronages.${i}.value`)}
              errors={(i) => errors.patronages?.[i]?.value?.message}
              onAdd={() => patronages.append({ value: "" })}
              onRemove={patronages.remove}
              addLabel={t("addPatronage")}
            />
          </Section>

          <Section title={t("sections.sources")} description={t("sections.sourcesHelp")}>
            <ListField
              label={t("fields.sources")}
              hideLabel
              items={sources.fields}
              register={(i) => register(`sources.${i}.value`)}
              errors={(i) => errors.sources?.[i]?.value?.message}
              onAdd={() => sources.append({ value: "" })}
              onRemove={sources.remove}
              addLabel={t("addSource")}
              placeholder={t("hints.source")}
            />
          </Section>
        </div>

        {/* Right column: portrait + live card preview */}
        <aside className="space-y-6 lg:sticky lg:top-32 lg:self-start">
          <Section title={t("sections.portrait")}>
            <PortraitEditor
              saintId={record?.id ?? null}
              portraitUrl={portraitUrl}
              settings={watched.portrait ?? { focalX: 50, focalY: 50, zoom: 1, fit: "cover" }}
              onSettingsChange={(p) => setValue("portrait", p, { shouldDirty: true })}
              onSaved={onPortraitSaved}
              maxUploadMb={maxUploadMb}
            />
          </Section>
          <Section title={t("sections.preview")} description={t("sections.previewHelp")}>
            <CardPreview saint={preview} settings={{ ...worksheetSettings, perPage: 2, photoFit: "saint" }} onOverflowChange={setOverflow} />
            {portraitUrl && worksheetSettings.photoFit !== "saint" && (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("photoFitNotice", { active: tb(`photoFit.${worksheetSettings.photoFit}`), saint: tb("photoFit.saint") })}
              </p>
            )}
            {overflow && (
              <p className="mt-2 text-xs text-destructive" role="status">
                {t("overflow", { size: worksheetSettings.fontSizePt })}
              </p>
            )}
          </Section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("delete.title", { name: record?.name ?? "" })}
        description={
          <>
            <p>{t("delete.body", { collections: collectionNames.length })}</p>
            <p className="font-medium text-foreground">{t("delete.warning")}</p>
          </>
        }
        confirmLabel={tc("delete")}
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
  const t = useTranslations("editor");
  return (
    <div className="space-y-2">
      {!props.hideLabel && <p className="text-sm font-medium">{props.label}</p>}
      {props.items.map((item, i) => (
        <div key={item.id}>
          <div className="flex gap-2">
            <Input {...props.register(i)} placeholder={props.placeholder} aria-label={t("listItem", { label: props.label, n: i + 1 })} aria-invalid={!!props.errors(i)} />
            <Button type="button" variant="ghost" size="icon" onClick={() => props.onRemove(i)} aria-label={t("removeListItem", { label: props.label.toLowerCase(), n: i + 1 })}>
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
