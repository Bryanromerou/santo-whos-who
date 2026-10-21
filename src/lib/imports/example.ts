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

export type FieldDoc = { field: string; type: string; required: boolean; description: string };

export const TOP_LEVEL_FIELDS: FieldDoc[] = [
  { field: "schemaVersion", type: "número", required: true, description: "Siempre 1." },
  { field: "format", type: "texto", required: true, description: 'Siempre "santos-studio-library".' },
  { field: "language", type: "texto", required: true, description: 'Siempre "es".' },
  { field: "source", type: "objeto", required: false, description: "De dónde salen los datos: document, notes, factCheckedIndividually." },
  { field: "saints", type: "lista", required: true, description: "Los santos (puede tener cualquier cantidad)." },
  { field: "collections", type: "lista", required: false, description: "Colecciones opcionales que agrupan santos por id." },
];

export const SAINT_FIELDS: FieldDoc[] = [
  { field: "id", type: "texto", required: true, description: "Identificador único y estable, en minúsculas con guiones: «santa-rosa-de-lima». Si ya existe en tu biblioteca, el santo se salta (modo por defecto)." },
  { field: "name", type: "texto", required: true, description: "Nombre tal como se imprime." },
  { field: "birthYear", type: "número o null", required: true, description: "Año de nacimiento; null si se desconoce. No inventes fechas." },
  { field: "birthYearDisplay", type: "texto", required: true, description: "Texto que se imprime: «1586», «aprox. 1181–1182»." },
  { field: "ageAtDeath", type: "número o null", required: true, description: "Edad al morir; null si se desconoce." },
  { field: "ageAtDeathDisplay", type: "texto", required: true, description: "Texto que se imprime: «31 años», «aprox. 13–14 años»." },
  { field: "country", type: "texto", required: true, description: "País de origen tal como se imprime." },
  { field: "portraitPath", type: "null", required: true, description: "Déjalo en null. Las fotos se suben después con «Importar retratos»." },
  { field: "isMartyr", type: "true / false", required: true, description: "Si fue mártir." },
  { field: "categories", type: "lista de textos", required: true, description: "Etiquetas para filtrar: santos-jovenes, martires, educadores-y-guias, patronos-de-la-juventud… Puede ir vacía []." },
  { field: "patronages", type: "lista de textos", required: true, description: "Patronazgos. Puede ir vacía []." },
  { field: "canonizationYear", type: "número o null", required: true, description: "Año de canonización; null si no aplica o no se sabe." },
  { field: "characteristics", type: "lista", required: true, description: "Viñetas de la ficha, en orden (se recomiendan 5–8). Ver abajo." },
  { field: "sources", type: "lista de textos", required: true, description: "Fuentes o enlaces para la revisión. Puede ir vacía []." },
  { field: "reviewStatus", type: "texto", required: true, description: '"needs_review" (pendiente) o "reviewed" (revisado).' },
];

export const CHARACTERISTIC_FIELDS: FieldDoc[] = [
  { field: "id", type: "texto", required: true, description: "Único dentro del santo, p. ej. «santa-rosa-de-lima-c1»." },
  { field: "text", type: "texto", required: true, description: "La viñeta. No puede estar vacía. Para milagros conserva «según testimonios», «se le atribuye»…" },
  { field: "type", type: "texto", required: true, description: "biography, virtue, miracle, patronage, martyrdom, canonization, legacy u other." },
];

export const COLLECTION_FIELDS: FieldDoc[] = [
  { field: "id", type: "texto", required: true, description: "Identificador único. Si ya existe, sus santos nuevos se añaden a esa colección." },
  { field: "name", type: "texto", required: true, description: "Nombre visible." },
  { field: "saintIds", type: "lista de textos", required: true, description: "Ids de santos en orden. Pueden ser del archivo o que ya estén en tu biblioteca." },
];
