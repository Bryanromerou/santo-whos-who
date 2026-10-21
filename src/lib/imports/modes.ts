/** Import modes (client-safe: no server imports). Labels live in messages/*.json → import.modes. */
export const IMPORT_MODES = ["skip", "update", "replace"] as const;
export type ImportMode = (typeof IMPORT_MODES)[number];
