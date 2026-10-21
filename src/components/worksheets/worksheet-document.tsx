import type { CSSProperties } from "react";
import type { WorksheetSaint } from "@/lib/worksheet/card-data";
import type { WorksheetPage } from "@/lib/worksheet/paginate";
import { PAPER_SIZES, type WorksheetSettings } from "@/lib/worksheet/settings";
import { PortraitFrame } from "./portrait-frame";

export function documentStyle(settings: WorksheetSettings): CSSProperties {
  const paper = PAPER_SIZES[settings.paperSize];
  return {
    "--ws-page-w": `${paper.widthIn}in`,
    "--ws-page-h": `${paper.heightIn}in`,
    "--ws-margin": `${settings.marginIn}in`,
    "--ws-font": `${settings.fontSizePt}pt`,
    "--ws-bullet-gap": `${settings.bulletSpacingPt}pt`,
    "--ws-img-w": `${settings.imageWidthPct}%`,
  } as CSSProperties;
}

/** One saint as a bordered table: name row, portrait column, facts and bullet list. */
export function SaintCard({ saint, settings, overflow }: { saint: WorksheetSaint; settings: WorksheetSettings; overflow?: boolean }) {
  return (
    <article className="ws-card" data-ws-card={saint.id} data-overflow={overflow ? "true" : undefined} lang="es">
      <h2 className="ws-card-name">{saint.name}</h2>
      <div className="ws-card-body" data-no-portrait={settings.showPortrait ? undefined : ""}>
        {settings.showPortrait && (
          <div className="ws-portrait-col" data-ws-measure="">
            <PortraitFrame portrait={saint.portrait} name={saint.name} />
          </div>
        )}
        <div className="ws-info" data-ws-measure="">
          <div className="ws-facts">
            <div className="ws-fact">
              <span className="ws-label">Año de nacimiento</span>
              <span className="ws-value">{saint.birth}</span>
            </div>
            <div className="ws-fact">
              <span className="ws-label">Edad al morir</span>
              <span className="ws-value">{saint.age}</span>
            </div>
          </div>
          {settings.showCountry && (
            <div className="ws-country">
              <span className="ws-label">País de origen</span>
              <span className="ws-value">{saint.country}</span>
            </div>
          )}
          <div className="ws-chars">
            <span className="ws-label">Características</span>
            <ul>
              {saint.characteristics.map((c) => (
                <li key={c.id}>{c.text}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </article>
  );
}

type Props = {
  pages: WorksheetPage[];
  saints: Record<string, WorksheetSaint>;
  settings: WorksheetSettings;
  overflowIds?: ReadonlySet<string>;
  className?: string;
  pageClassName?: string;
};

/** The full multipage worksheet. Used unchanged for preview, print and PDF. */
export function WorksheetDocument({ pages, saints, settings, overflowIds, className, pageClassName }: Props) {
  return (
    <div className={["ws-doc", className].filter(Boolean).join(" ")} style={documentStyle(settings)}>
      {pages.map((page, i) => (
        <section key={i} className={["ws-page", pageClassName].filter(Boolean).join(" ")} data-ws-page={i + 1} aria-label={`Página ${i + 1}`}>
          <div className="ws-slots" data-per-page={page.perPage}>
            {page.slots.map((id, j) => {
              const saint = id ? saints[id] : undefined;
              return (
                <div className="ws-slot" key={id ?? `empty-${j}`}>
                  {saint && <SaintCard saint={saint} settings={settings} overflow={overflowIds?.has(saint.id)} />}
                </div>
              );
            })}
          </div>
          {settings.showPageNumbers && (
            <div className="ws-page-number">
              Página {i + 1} de {pages.length}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

/** `@page` rule matching the chosen paper. Margins live inside .ws-page, so the browser margin is 0. */
export function PageRule({ settings }: { settings: WorksheetSettings }) {
  return <style>{`@page { size: ${PAPER_SIZES[settings.paperSize].css}; margin: 0; }`}</style>;
}
