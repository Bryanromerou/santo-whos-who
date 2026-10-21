/**
 * Example library file shown in the import modal and offered as a template.
 * Client-safe (no server imports). A unit test checks it passes the importer.
 */
export const EXAMPLE_LIBRARY = {
  schemaVersion: 1,
  format: "santos-studio-library",
  language: "es",
  source: {
    document: "Nombre del documento de origen (opcional)",
    notes: "Notas sobre el origen de los datos (opcional)",
    factCheckedIndividually: false,
  },
  saints: [
    {
      id: "santa-rosa-de-lima",
      name: "Santa Rosa de Lima",
      birthYear: 1586,
      birthYearDisplay: "1586",
      ageAtDeath: 31,
      ageAtDeathDisplay: "31 años",
      country: "Perú",
      portraitPath: null,
      isMartyr: false,
      categories: ["santos-jovenes"],
      patronages: ["América", "Perú"],
      canonizationYear: 1671,
      characteristics: [
        { id: "santa-rosa-de-lima-c1", text: "Nació en Lima, en el virreinato del Perú.", type: "biography" },
        { id: "santa-rosa-de-lima-c2", text: "Vivió una intensa vida de oración como terciaria dominica.", type: "virtue" },
        { id: "santa-rosa-de-lima-c3", text: "Atendía a enfermos y personas pobres en su propia casa.", type: "biography" },
        { id: "santa-rosa-de-lima-c4", text: "Fue canonizada en 1671; es patrona de América y del Perú.", type: "canonization" },
      ],
      sources: [],
      reviewStatus: "needs_review",
    },
  ],
  collections: [{ id: "santos-jovenes", name: "Santos jóvenes", saintIds: ["santa-rosa-de-lima"] }],
} as const;

export const EXAMPLE_JSON = JSON.stringify(EXAMPLE_LIBRARY, null, 2);

/** Field reference for the import help. Types and descriptions live in messages/*.json → import.format. */
export type FieldType = "number" | "text" | "object" | "list" | "numberOrNull" | "null" | "boolean" | "textList";
export type FieldDoc = { field: string; type: FieldType; required: boolean };

export const TOP_LEVEL_FIELDS: FieldDoc[] = [
  { field: "schemaVersion", type: "number", required: true },
  { field: "format", type: "text", required: true },
  { field: "language", type: "text", required: true },
  { field: "source", type: "object", required: false },
  { field: "saints", type: "list", required: true },
  { field: "collections", type: "list", required: false },
];

export const SAINT_FIELDS: FieldDoc[] = [
  { field: "id", type: "text", required: true },
  { field: "name", type: "text", required: true },
  { field: "birthYear", type: "numberOrNull", required: true },
  { field: "birthYearDisplay", type: "text", required: true },
  { field: "ageAtDeath", type: "numberOrNull", required: true },
  { field: "ageAtDeathDisplay", type: "text", required: true },
  { field: "country", type: "text", required: true },
  { field: "portraitPath", type: "null", required: true },
  { field: "isMartyr", type: "boolean", required: true },
  { field: "categories", type: "textList", required: true },
  { field: "patronages", type: "textList", required: true },
  { field: "canonizationYear", type: "numberOrNull", required: true },
  { field: "characteristics", type: "list", required: true },
  { field: "sources", type: "textList", required: true },
  { field: "reviewStatus", type: "text", required: true },
];

export const CHARACTERISTIC_FIELDS: FieldDoc[] = [
  { field: "id", type: "text", required: true },
  { field: "text", type: "text", required: true },
  { field: "type", type: "text", required: true },
];

export const COLLECTION_FIELDS: FieldDoc[] = [
  { field: "id", type: "text", required: true },
  { field: "name", type: "text", required: true },
  { field: "saintIds", type: "textList", required: true },
];
