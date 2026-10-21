"use client";

import { useState, type CSSProperties } from "react";
import type { WorksheetSaint } from "@/lib/worksheet/card-data";

export function portraitImageStyle(p: NonNullable<WorksheetSaint["portrait"]>): CSSProperties {
  const origin = `${p.focalX}% ${p.focalY}%`;
  return {
    objectFit: p.fit,
    objectPosition: origin,
    transform: p.zoom !== 1 ? `scale(${p.zoom})` : undefined,
    transformOrigin: origin,
  };
}

/** Portrait box with fixed 3:4 aspect ratio. Missing/broken images show "Espacio para foto". */
export function PortraitFrame({ portrait, name }: { portrait: WorksheetSaint["portrait"]; name: string }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!portrait || failedSrc === portrait.src) {
    return (
      <div className="ws-portrait ws-portrait-empty" data-ws-placeholder="">
        Espacio para foto
      </div>
    );
  }
  return (
    <div className="ws-portrait">
      {/* eslint-disable-next-line @next/next/no-img-element -- local same-origin file; next/image would re-encode for print */}
      <img
        src={portrait.src}
        alt={`Retrato de ${name}`}
        style={portraitImageStyle(portrait)}
        decoding="sync"
        loading="eager"
        onError={() => setFailedSrc(portrait.src)}
      />
    </div>
  );
}
