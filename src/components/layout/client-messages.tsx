"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { setClientApiMessages } from "@/lib/client-api";

/** Hands the fetch helper (plain module, no hooks) its messages in the interface language. */
export function ClientMessages() {
  const t = useTranslations("common");
  useEffect(() => {
    setClientApiMessages({ offline: t("serverOffline") });
  }, [t]);
  return null;
}
