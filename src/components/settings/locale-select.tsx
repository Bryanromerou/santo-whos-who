"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LOCALE_NAMES, LOCALES, type Locale } from "@/i18n/config";
import { api } from "@/lib/client-api";

/** Interface language selector. Saved in the local database, so it applies to every browser and is included in backups. */
export function LocaleSelect({ value }: { value: Locale }) {
  const router = useRouter();
  const t = useTranslations("settings.language");
  const [busy, setBusy] = useState(false);

  async function change(next: string) {
    if (next === value) return;
    setBusy(true);
    try {
      await api("/api/settings/locale", { method: "PUT", json: { locale: next } });
      router.refresh();
    } catch (e) {
      toast.error(t("error"), { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Select value={value} onValueChange={change} disabled={busy}>
      <SelectTrigger className="w-[220px]" aria-label={t("title")} data-testid="locale-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LOCALES.map((l) => (
          <SelectItem key={l} value={l} lang={l}>
            {LOCALE_NAMES[l]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
