import { describe, expect, it } from "vitest";
import { closeDb, getDb, sqliteHandle } from "@/db/client";
import { listCollections } from "@/db/repositories/collections";
import { countSaints, getSaint, listSaints } from "@/db/repositories/saints";
import { characteristics } from "@/db/schema";
import { buildLibraryExport } from "@/lib/exports/export-library";
import { importLibrary } from "@/lib/imports/import-library";
import { validateLibrary } from "@/lib/imports/validate";
import { clone, freshDb, loadFixture } from "./helpers";

describe("importing the 43-saint library", () => {
  it("imports 43 saints, 258 characteristics and 6 collections", async () => {
    freshDb();
    const result = await importLibrary(loadFixture(), "skip");
    expect(result.summary).toBe("43 santos importados · 258 características · 6 colecciones");
    expect(countSaints()).toBe(43);
    expect(getDb().select().from(characteristics).all()).toHaveLength(258);
    expect(listCollections()).toHaveLength(6);
    for (const s of listSaints()) expect(s.characteristics.length).toBeGreaterThan(0);
  });

  it("preserves text, accents, ordering and approximations exactly", async () => {
    freshDb();
    const f = loadFixture();
    await importLibrary(f, "skip");
    for (const src of f.saints) {
      const s = getSaint(src.id)!;
      expect(s.name).toBe(src.name);
      expect(s.birthYearDisplay).toBe(src.birthYearDisplay);
      expect(s.ageAtDeathDisplay).toBe(src.ageAtDeathDisplay);
      expect(s.canonizationYear).toBe(src.canonizationYear);
      expect(s.reviewStatus).toBe(src.reviewStatus);
      expect(s.characteristics).toEqual(src.characteristics.map((c) => ({ id: c.id, text: c.text, type: c.type })));
      expect(s.patronages).toEqual(src.patronages);
      expect(s.categories).toEqual([...new Set(src.categories)]);
    }
    const order = listSaints().map((s) => s.id);
    expect(order).toEqual(f.saints.map((s) => s.id));
    for (const c of f.collections) {
      expect(listCollections().find((x) => x.id === c.id)!.saintIds).toEqual(c.saintIds);
    }
  });

  it("skips existing records by default (no duplicates, no overwrite)", async () => {
    freshDb();
    await importLibrary(loadFixture(), "skip");
    const edited = clone(loadFixture());
    edited.saints[0].name = "Nombre cambiado";
    const result = await importLibrary(edited, "skip");
    expect(result.counts.saintsSkipped).toBe(43);
    expect(result.counts.saintsCreated).toBe(0);
    expect(countSaints()).toBe(43);
    expect(getSaint(edited.saints[0].id)!.name).toBe(loadFixture().saints[0].name);
  });

  it("updates existing records when asked", async () => {
    freshDb();
    await importLibrary(loadFixture(), "skip");
    const edited = clone(loadFixture());
    edited.saints[1].characteristics[0].text = "Texto actualizado — con acentos: árbol, niño.";
    const result = await importLibrary(edited, "update");
    expect(result.counts.saintsUpdated).toBe(43);
    expect(getSaint(edited.saints[1].id)!.characteristics[0].text).toBe("Texto actualizado — con acentos: árbol, niño.");
  });

  it("requires explicit confirmation to replace the library", async () => {
    freshDb();
    await importLibrary(loadFixture(), "skip");
    await expect(importLibrary(loadFixture(), "replace")).rejects.toThrow(/confirmación/);
    const small = clone(loadFixture());
    small.saints = small.saints.slice(0, 3);
    small.collections = [{ id: "tres", name: "Tres", saintIds: small.saints.map((s) => s.id) }];
    const r = await importLibrary(small, "replace", { confirmReplace: true });
    expect(r.counts.saintsDeleted).toBe(43);
    expect(countSaints()).toBe(3);
    expect(listCollections().map((c) => c.id)).toEqual(["tres"]);
  });

  it("writes nothing when validation fails", async () => {
    freshDb();
    const bad = clone(loadFixture());
    bad.saints[40].characteristics[0].text = "";
    await expect(importLibrary(bad, "skip")).rejects.toThrow(/no se importó nada/);
    expect(countSaints()).toBe(0);
  });

  it("rolls back the whole transaction if a write fails midway", async () => {
    freshDb();
    const f = clone(loadFixture());
    // Force a failure on the last saint by pre-creating a conflicting primary key inside SQLite.
    sqliteHandle().exec("CREATE TRIGGER boom BEFORE INSERT ON characteristics WHEN NEW.saint_id = '" + f.saints[42].id + "' BEGIN SELECT RAISE(ABORT, 'falla simulada'); END;");
    await expect(importLibrary(f, "skip")).rejects.toThrow(/falla simulada/);
    sqliteHandle().exec("DROP TRIGGER boom");
    expect(countSaints()).toBe(0);
    expect(listCollections()).toHaveLength(0);
  });

  it("round-trips: export → import into an empty DB gives identical data and order", async () => {
    freshDb();
    await importLibrary(loadFixture(), "skip");
    const exported = buildLibraryExport();
    freshDb();
    const { report } = validateLibrary(exported, "skip");
    expect(report.ok).toBe(true);
    await importLibrary(exported, "skip");
    expect(buildLibraryExport()).toEqual(exported);
    closeDb();
  });
});
