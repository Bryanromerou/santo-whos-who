type Values = Record<string, string | number>;

/** Untyped-key view of a translator, for helpers that build keys from data (client-safe, no imports). */
export type LooseT = (key: string, values?: Values) => string;
export const loose = (t: unknown) => t as LooseT;
