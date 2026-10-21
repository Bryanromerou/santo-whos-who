import { beforeEach, describe, expect, it } from "vitest";
import { analyzeLibrary, parseJsonText, parseLibrary, validateLibrary } from "@/lib/imports/validate";
import { clone, freshDb, loadFixture } from "./helpers";

beforeEach(() => {
  freshDb();
});

describe("library JSON schema", () => {
  it("accepts the 43-saint library file", () => {
    const { data, errors } = parseLibrary(loadFixture());
    expect(errors).toEqual([]);
    expect(data!.saints).toHaveLength(43);
    expect(data!.saints.reduce((n, s) => n + s.characteristics.length, 0)).toBe(258);
    expect(data!.collections).toHaveLength(6);
  });

  it("rejects wrong top-level metadata with Spanish messages", () => {
    const f = clone(loadFixture()) as Record<string, unknown>;
    f.schemaVersion = 2;
    f.format = "otro";
    const { errors } = parseLibrary(f, "es");
    expect(errors.join("\n")).toContain("schemaVersion debe ser 1");
    expect(errors.join("\n")).toContain('format debe ser "santos-studio-library"');
  });

  it("rejects non-objects and invalid JSON text", () => {
    expect(parseLibrary([], "es").errors[0]).toMatch(/objeto JSON/);
    expect(parseJsonText("{ nope", "es").error).toMatch(/no es JSON válido/);
  });

  it("names the saint and field for invalid characteristic types and empty texts", () => {
    const f = clone(loadFixture());
    (f.saints[4].characteristics[1] as { type: string }).type = "rumor";
    f.saints[5].characteristics[0].text = "   ";
    const { errors } = parseLibrary(f, "es");
    const all = errors.join("\n");
    expect(all).toContain(`Santo n.º 5 («${f.saints[4].name}») › característica n.º 2 › tipo`);
    expect(all).toContain("Valores permitidos");
    expect(all).toContain("El texto de la característica no puede estar vacío");
  });

  it("requires boolean isMartyr and valid reviewStatus", () => {
    const f = clone(loadFixture()) as unknown as { saints: Record<string, unknown>[] };
    f.saints[0].isMartyr = "sí";
    f.saints[1].reviewStatus = "ok";
    const { errors } = parseLibrary(f, "es");
    expect(errors.some((e) => e.includes("isMartyr debe ser true o false"))).toBe(true);
    expect(errors.some((e) => e.includes("reviewStatus"))).toBe(true);
  });
});

describe("cross-reference validation", () => {
  it("detects duplicate saint ids and duplicate characteristic ids", () => {
    const f = clone(loadFixture());
    f.saints[1].id = f.saints[0].id;
    f.saints[2].characteristics[1].id = f.saints[2].characteristics[0].id;
    const { report } = validateLibrary(f, "skip");
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.includes("aparece 2 veces"))).toBe(true);
    expect(report.errors.some((e) => e.includes("está repetido"))).toBe(true);
  });

  it("detects collections that reference unknown or repeated saints", () => {
    const f = clone(loadFixture());
    f.collections[0].saintIds.push("no-existe");
    f.collections[1].saintIds.push(f.collections[1].saintIds[0]);
    const { report } = validateLibrary(f, "skip");
    expect(report.errors.some((e) => e.includes("«no-existe» no existe"))).toBe(true);
    expect(report.errors.some((e) => e.includes("aparece más de una vez"))).toBe(true);
  });

  it("produces a dry-run plan without writing anything", () => {
    const f = loadFixture();
    const { data } = parseLibrary(f);
    const report = analyzeLibrary(data!, "skip");
    expect(report.ok).toBe(true);
    expect(report.stats).toMatchObject({ saints: 43, characteristics: 258, collections: 6 });
    expect(report.plan.saintsCreate).toBe(43);
    expect(report.existingSaints).toEqual([]);
  });

  it("warns (not fails) when a portrait path is not available", () => {
    const f = clone(loadFixture());
    f.saints[0].portraitPath = "https://example.com/foto.jpg";
    const { report } = validateLibrary(f, "skip");
    expect(report.ok).toBe(true);
    expect(report.warnings.some((w) => w.includes("se importará sin foto"))).toBe(true);
  });
});

describe("format example shown in the import modal", () => {
  it("is a valid library file the importer accepts", async () => {
    const { EXAMPLE_LIBRARY, EXAMPLE_JSON, SAINT_FIELDS } = await import("@/lib/imports/example");
    const { report } = validateLibrary(JSON.parse(EXAMPLE_JSON), "skip");
    expect(report.errors).toEqual([]);
    expect(report.ok).toBe(true);
    // Every saint key in the example is documented, and vice versa.
    expect(Object.keys(EXAMPLE_LIBRARY.saints[0]).sort()).toEqual(SAINT_FIELDS.map((f) => f.field).sort());
  });
});
