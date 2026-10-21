"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { WorksheetSaint } from "@/lib/worksheet/card-data";
import { PAPER_SIZES, type WorksheetSettings } from "@/lib/worksheet/settings";
import { findOverflowingCards, waitForAssets } from "./measure";
import { documentStyle, SaintCard } from "./worksheet-document";

const PX_PER_IN = 96;
const PAGE_NUMBER_IN = 0.3;

/** Size (in inches) of one card slot for the given settings — same math as the print grid. */
export function slotSizeIn(settings: WorksheetSettings, perPage = settings.perPage) {
  const paper = PAPER_SIZES[settings.paperSize];
  const innerW = paper.widthIn - 2 * settings.marginIn;
  const innerH = paper.heightIn - 2 * settings.marginIn - (settings.showPageNumbers ? PAGE_NUMBER_IN : 0);
  const gap = 0.28;
  if (perPage === 1) return { w: innerW, h: innerH };
  if (perPage === 2) return { w: innerW, h: (innerH - gap) / 2 };
  const g4 = gap * 0.8;
  return { w: (innerW - g4) / 2, h: (innerH - g4) / 2 };
}

/**
 * A single card rendered at its real printed size (then scaled to fit the
 * column), so the editor shows exactly what the worksheet will print.
 */
export function CardPreview({ saint, settings, onOverflowChange }: { saint: WorksheetSaint; settings: WorksheetSettings; onOverflowChange?: (o: boolean) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [overflow, setOverflow] = useState(false);
  const size = slotSizeIn(settings);
  const wPx = size.w * PX_PER_IN;
  const hPx = size.h * PX_PER_IN;

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(Math.min(1, el.clientWidth / wPx)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [wPx]);

  useEffect(() => {
    let cancelled = false;
    const root = docRef.current;
    if (!root) return;
    void waitForAssets(root).then(() => {
      if (cancelled) return;
      const o = findOverflowingCards(root).length > 0;
      setOverflow(o);
      onOverflowChange?.(o);
    });
    return () => {
      cancelled = true;
    };
  }, [saint, settings, onOverflowChange]);

  return (
    <div ref={wrapRef} className="w-full">
      <div style={{ height: hPx * scale }} className="relative">
        <div style={{ width: wPx, height: hPx, transform: `scale(${scale})`, transformOrigin: "top left" }} className="absolute top-0 left-0 shadow-sm">
          <div ref={docRef} className="ws-doc h-full bg-white" style={documentStyle(settings)}>
            <SaintCard saint={saint} settings={settings} overflow={overflow} />
          </div>
        </div>
      </div>
    </div>
  );
}
