"use client";

import { useEffect } from "react";
import { findOverflowingCards, waitForAssets } from "./measure";

/**
 * Waits for fonts and images, runs the overflow check, and publishes the
 * result on <html data-ws-ready data-ws-overflow> for the PDF exporter.
 * With autoPrint, opens the print dialog only if nothing overflows, and
 * reports back to the builder window (when shown inside its iframe).
 */
export function PrintReady({ autoPrint }: { autoPrint: boolean }) {
  useEffect(() => {
    let cancelled = false;
    const post = (status: string, extra: Record<string, unknown> = {}) => {
      if (window.parent !== window) window.parent.postMessage({ type: "santos-print", status, ...extra }, location.origin);
    };
    void (async () => {
      await waitForAssets(document);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      if (cancelled) return;
      const overflow = findOverflowingCards(document);
      const html = document.documentElement;
      html.dataset.wsOverflow = JSON.stringify(overflow);
      html.dataset.wsReady = "true";
      if (!autoPrint) return;
      if (overflow.length) {
        post("overflow", { overflow });
        return;
      }
      window.addEventListener("afterprint", () => post("done"), { once: true });
      window.print();
      // Safari doesn't always fire afterprint inside iframes.
      setTimeout(() => post("done"), 1000);
    })();
    return () => {
      cancelled = true;
    };
  }, [autoPrint]);
  return null;
}
