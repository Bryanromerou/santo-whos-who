/** Import modes (client-safe: no server imports). */
export const IMPORT_MODES = ["skip", "update", "replace"] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];

export const IMPORT_MODE_LABELS: Record<ImportMode, string> = {
  skip: "Saltar existentes",
  update: "Actualizar existentes",
  replace: "Reemplazar biblioteca",
};
