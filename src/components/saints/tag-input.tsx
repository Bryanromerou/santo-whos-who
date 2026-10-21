"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { categoryLabel } from "@/lib/categories";

type Props = {
  value: string[];
  onChange: (v: string[]) => void;
  suggestions: string[];
  id?: string;
  placeholder?: string;
};

/** Category tags: Enter or comma adds, Backspace on empty removes the last tag. */
export function TagInput({ value, onChange, suggestions, id, placeholder }: Props) {
  const t = useTranslations("editor.tags");
  const [draft, setDraft] = useState("");
  const add = (raw: string) => {
    const tag = raw.trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft("");
  };
  const remaining = suggestions.filter((s) => !value.includes(s));
  return (
    <div className="space-y-2">
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5 focus-within:ring-3 focus-within:ring-ring/50">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs">
            {categoryLabel(tag)}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== tag))} aria-label={t("remove", { name: categoryLabel(tag) })} className="rounded-full hover:bg-muted">
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <Input
          id={id}
          value={draft}
          placeholder={value.length ? "" : placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft && add(draft)}
          className="h-6 min-w-[8rem] flex-1 border-0 p-0 shadow-none focus-visible:ring-0"
        />
      </div>
      {remaining.length > 0 && (
        <div className="flex flex-wrap gap-1" aria-label={t("suggested")}>
          {remaining.map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
              + {categoryLabel(s)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
