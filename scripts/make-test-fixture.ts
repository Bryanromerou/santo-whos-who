// Generates tests/fixtures/library-43.json: SYNTHETIC TEST DATA with the same
// shape and counts as santos_studio_43_santos.json (43 saints × 6 characteristics,
// 6 collections). It is only used by automated tests — never as app content.
import fs from "node:fs";
import path from "node:path";

const TYPES = ["biography", "virtue", "miracle", "patronage", "canonization", "legacy"] as const;

const named: Record<number, { name: string; id: string; country: string; birth: [number | null, string]; age: [number | null, string]; martyr: boolean }> = {
  0: { id: "jose-sanchez-del-rio", name: "San José Sánchez del Río", country: "México", birth: [1913, "1913"], age: [14, "14 años"], martyr: true },
  1: { id: "carlo-acutis", name: "San Carlo Acutis", country: "Italia (nacido en Londres)", birth: [1991, "1991"], age: [15, "15 años"], martyr: false },
  2: { id: "santo-prueba-03", name: "Santa Inés (prueba)", country: "Imperio romano", birth: [null, "c. 291 (aprox.)"], age: [null, "aprox. 12–13 años"], martyr: true },
};

const sentences = [
  "Texto de prueba sobre su infancia: creció en una familia sencilla y participó con entusiasmo en la vida de su parroquia y de su comunidad.",
  "Texto de prueba sobre sus virtudes: se le recuerda por su paciencia, su alegría y su cercanía con los más pobres, los enfermos y los olvidados.",
  "Según testimonios recogidos en el proceso, se le atribuye una curación inexplicable; la tradición cuenta que muchos acudían a pedir su intercesión.",
  "Texto de prueba sobre su patronazgo: es invocado como patrono de estudiantes, catequistas y grupos juveniles en distintos países de habla hispana.",
  "Texto de prueba sobre su canonización: el proceso concluyó tras el reconocimiento de un milagro atribuido a su intercesión, según la Iglesia.",
  "Texto de prueba sobre su legado: su ejemplo sigue inspirando a jóvenes de todo el mundo a vivir la fe con valentía, servicio y sencillez.",
];

const saints = Array.from({ length: 43 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  const base = named[i] ?? {
    id: `santo-prueba-${n}`,
    name: `Santo de prueba ${n}`,
    country: ["España", "Perú", "Francia", "Colombia", "Polonia", "Filipinas"][i % 6],
    birth: [1800 + i * 3, i % 5 === 0 ? `c. ${1800 + i * 3}` : String(1800 + i * 3)] as [number, string],
    age: [20 + (i % 50), `${20 + (i % 50)} años`] as [number, string],
    martyr: i % 4 === 0,
  };
  return {
    id: base.id,
    name: base.name,
    birthYear: base.birth[0],
    birthYearDisplay: base.birth[1],
    ageAtDeath: base.age[0],
    ageAtDeathDisplay: base.age[1],
    country: base.country,
    portraitPath: null,
    isMartyr: base.martyr,
    categories: [
      ...(base.age[0] !== null && base.age[0] < 30 ? ["santos-jovenes"] : []),
      ...(base.martyr ? ["santos-martires"] : []),
      ...(i % 5 === 1 ? ["educadores-y-guias"] : []),
      ...(i % 3 === 0 ? ["patronos-de-la-juventud"] : []),
    ],
    patronages: i % 2 === 0 ? ["Jóvenes", "Estudiantes"] : [],
    canonizationYear: i % 3 === 0 ? 1950 + i : null,
    characteristics: TYPES.map((type, j) => ({ id: `${base.id}-c${j + 1}`, text: sentences[j], type })),
    sources: [],
    reviewStatus: i % 7 === 0 ? "reviewed" : "needs_review",
  };
});

const ids = saints.map((s) => s.id);
const fixture = {
  schemaVersion: 1,
  format: "santos-studio-library",
  language: "es",
  source: {
    document: "DATOS DE PRUEBA — generado por scripts/make-test-fixture.ts",
    notes: "No contiene biografías reales. Solo para pruebas automáticas.",
    factCheckedIndividually: false,
  },
  saints,
  collections: [
    { id: "originales-26", name: "Santos originales (26)", saintIds: ids.slice(0, 26) },
    { id: "adicionales-17", name: "Santos adicionales (17)", saintIds: ids.slice(26) },
    { id: "santos-jovenes", name: "Santos jóvenes", saintIds: saints.filter((s) => s.categories.includes("santos-jovenes")).map((s) => s.id) },
    { id: "santos-martires", name: "Santos mártires", saintIds: saints.filter((s) => s.isMartyr).map((s) => s.id) },
    { id: "educadores-y-guias", name: "Educadores y guías", saintIds: saints.filter((s) => s.categories.includes("educadores-y-guias")).map((s) => s.id) },
    { id: "patronos-juventud", name: "Patronos de la juventud", saintIds: saints.filter((s) => s.categories.includes("patronos-de-la-juventud")).map((s) => s.id) },
  ],
};

const out = path.resolve(process.cwd(), "tests/fixtures/library-43.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(fixture, null, 2) + "\n");
console.log(`Escrito ${out}: ${saints.length} santos, ${saints.length * 6} características, ${fixture.collections.length} colecciones`);
