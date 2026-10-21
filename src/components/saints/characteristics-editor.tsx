"use client";

import { useId } from "react";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useWatch, type Control, type FieldErrors, type UseFormRegister } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CHARACTERISTIC_TYPES } from "@/db/schema";
import { cn } from "@/lib/utils";
import type { SaintFormValues } from "./saint-form";

// Characteristic text is Spanish content, so the attribution check stays Spanish in every interface language.
const ATTRIBUTION = /(seg[uú]n|tradici[oó]n|se (le |les )?atribuye|atribuid|testimoni|se cuenta|cuentan|relat|refier|habr[ií]a|afirm)/i;

type Props = {
  control: Control<SaintFormValues>;
  register: UseFormRegister<SaintFormValues>;
  errors: FieldErrors<SaintFormValues>;
};

export function newCharacteristicId() {
  return `c-${crypto.randomUUID().slice(0, 8)}`;
}

export function CharacteristicsEditor({ control, register, errors }: Props) {
  const { fields, append, remove, move } = useFieldArray({ control, name: "characteristics", keyName: "key" });
  const values = useWatch({ control, name: "characteristics" });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const dndId = useId();
  const t = useTranslations("editor.characteristics");

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = fields.findIndex((f) => f.key === e.active.id);
    const to = fields.findIndex((f) => f.key === e.over!.id);
    if (from >= 0 && to >= 0) move(from, to);
  };

  const n = fields.length;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={cn("text-xs", n < 5 || n > 8 ? "text-warning-foreground" : "text-muted-foreground")} aria-live="polite">
          {t("count", { count: n })}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">{t("attributionTip")}</p>
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={fields.map((f) => f.key)} strategy={verticalListSortingStrategy}>
          <ol className="space-y-2">
            {fields.map((field, index) => {
              const v = values?.[index];
              const missingAttribution = v?.type === "miracle" && v.text.trim() !== "" && !ATTRIBUTION.test(v.text);
              return (
                <SortableRow key={field.key} id={field.key}>
                  {(handle) => (
                    <div className="flex gap-2 rounded-lg border bg-background p-2">
                      <div className="flex flex-col items-center gap-0.5 pt-1">
                        <button
                          type="button"
                          {...handle}
                          className="cursor-grab rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
                          aria-label={t("drag", { n: index + 1 })}
                        >
                          <GripVertical className="size-4" aria-hidden />
                        </button>
                        <span className="text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                      </div>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Textarea
                          {...register(`characteristics.${index}.text`)}
                          rows={2}
                          className="min-h-[3.25rem] resize-y text-sm"
                          aria-label={t("text", { n: index + 1 })}
                          aria-invalid={!!errors.characteristics?.[index]?.text}
                        />
                        {errors.characteristics?.[index]?.text && (
                          <p className="text-xs text-destructive">{errors.characteristics[index]?.text?.message}</p>
                        )}
                        {missingAttribution && (
                          <p className="text-xs text-warning-foreground">{t("missingAttribution")}</p>
                        )}
                        <div className="flex flex-wrap items-center gap-1">
                          <Controller
                            control={control}
                            name={`characteristics.${index}.type`}
                            render={({ field: f }) => (
                              <Select value={f.value} onValueChange={f.onChange}>
                                <SelectTrigger size="sm" className="h-7 w-[180px] text-xs" aria-label={t("type", { n: index + 1 })}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CHARACTERISTIC_TYPES.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {t(`types.${type}`)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          <div className="ml-auto flex gap-0.5">
                            <Button type="button" variant="ghost" size="icon-xs" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={t("moveUp", { n: index + 1 })}>
                              <ArrowUp aria-hidden />
                            </Button>
                            <Button type="button" variant="ghost" size="icon-xs" disabled={index === n - 1} onClick={() => move(index, index + 1)} aria-label={t("moveDown", { n: index + 1 })}>
                              <ArrowDown aria-hidden />
                            </Button>
                            <Button type="button" variant="ghost" size="icon-xs" onClick={() => remove(index)} aria-label={t("remove", { n: index + 1 })} className="text-destructive">
                              <Trash2 aria-hidden />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </SortableRow>
              );
            })}
          </ol>
        </SortableContext>
      </DndContext>
      <Button type="button" variant="outline" size="sm" onClick={() => append({ id: newCharacteristicId(), text: "", type: "biography" })}>
        <Plus aria-hidden /> {t("add")}
      </Button>
    </div>
  );
}

function SortableRow({ id, children }: { id: string; children: (handle: Record<string, unknown>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative", isDragging && "z-10 opacity-80 shadow-lg")}
    >
      {children({ ...attributes, ...listeners, ref: setActivatorNodeRef })}
    </li>
  );
}
