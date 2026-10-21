"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

/** The "leave and lose changes?" prompt in the interface language. */
export function useUnsavedMessage(): string {
  return useTranslations("common")("unsavedLeave");
}

/**
 * Warns before leaving with unsaved changes: browser reload/close (beforeunload)
 * and in-app link clicks (captured before Next.js handles navigation).
 */
export function useUnsavedGuard(dirty: boolean) {
  const message = useUnsavedMessage();
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.search === location.search)) return;
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, message]);
}
