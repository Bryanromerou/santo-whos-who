import "server-only";
import { getSaintsByIds, listSaints, type SaintRecord } from "@/db/repositories/saints";
import { getSetting, setSetting, SETTING_KEYS } from "@/db/repositories/settings";
import { portraitFileExists, portraitUrls } from "@/lib/images/storage";
import { toWorksheetSaint, type WorksheetSaint } from "./card-data";
import { paginate } from "./paginate";
import { coerceConfig, type WorksheetConfig } from "./settings";

/** Card data with portrait URLs; portraits whose file is missing render as "Espacio para foto". */
export function worksheetSaint(s: SaintRecord): WorksheetSaint {
  const url = portraitFileExists(s.portraitPath) ? portraitUrls(s.portraitPath)!.master : null;
  return toWorksheetSaint(s, url);
}

export function worksheetSaintMap(records: SaintRecord[]): Record<string, WorksheetSaint> {
  return Object.fromEntries(records.map((r) => [r.id, worksheetSaint(r)]));
}

export function getWorksheetDraft(): WorksheetConfig {
  return coerceConfig(getSetting(SETTING_KEYS.worksheetDraft));
}

export function saveWorksheetDraft(config: WorksheetConfig) {
  setSetting(SETTING_KEYS.worksheetDraft, config);
}

/** Resolves a config into renderable pages; unknown/deleted saint ids are dropped. */
export function buildWorksheet(config: WorksheetConfig) {
  const records = getSaintsByIds(config.saintIds);
  const ids = records.map((r) => r.id);
  return {
    pages: paginate(ids, config.settings.perPage, config.soloSaintIds),
    saints: worksheetSaintMap(records),
    missing: config.saintIds.filter((id) => !ids.includes(id)),
  };
}

export { listSaints };
