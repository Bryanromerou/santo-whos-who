import { describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db/client";
import { addToCollection, createCollection, deleteCollection, getCollection, listCollections, updateCollection } from "@/db/repositories/collections";
import { createSaint, deleteSaint, duplicateSaint, getSaint, updateSaint } from "@/db/repositories/saints";
import { buildLibraryExport } from "@/lib/exports/export-library";
import { importLibrary } from "@/lib/imports/import-library";
import type { SaintInput } from "@/lib/schema/saint";
import { freshDb, loadFixture } from "./helpers";

function inputFrom(id: string): SaintInput {
  const s = getSaint(id)!;
  return {
    name: s.name,
    birthYear: s.birthYear,
    birthYearDisplay: s.birthYearDisplay,
    ageAtDeath: s.ageAtDeath,
    ageAtDeathDisplay: s.ageAtDeathDisplay,
    country: s.country,
    canonizationYear: s.canonizationYear,
    isMartyr: s.isMartyr,
    reviewStatus: s.reviewStatus,
    categories: s.categories,
    patronages: s.patronages,
    sources: s.sources,
    characteristics: s.characteristics,
    portrait: s.portrait,
    expectedUpdatedAt: s.updatedAt,
  };
}

describe("SQLite persistence", () => {
  it("export of a freshly imported file reproduces the file", async () => {
    freshDb();
    const f = loadFixture();
    await importLibrary(f, "skip");
    const out = buildLibraryExport();
    expect(out.saints).toEqual(f.saints.map((s) => ({ ...s, categories: [...new Set(s.categories)] })));
    expect(out.collections).toEqual(f.collections);
    expect(out.source).toEqual(f.source);
  });

  it("persists an edited characteristic across connection restarts", async () => {
    freshDb();
    await importLibrary(loadFixture(), "skip");
    const id = loadFixture().saints[1].id;
    const input = inputFrom(id);
    input.characteristics[0] = { ...input.characteristics[0], text: "Viñeta editada y guardada ✔︎" };
    updateSaint(id, input);
    closeDb();
    getDb();
    expect(getSaint(id)!.characteristics[0].text).toBe("Viñeta editada y guardada ✔︎");
  });

  it("rejects stale saves (edited elsewhere)", async () => {
    freshDb();
    await importLibrary(loadFixture(), "skip");
    const id = loadFixture().saints[0].id;
    const a = inputFrom(id);
    updateSaint(id, { ...a, country: "Uno" });
    expect(() => updateSaint(id, { ...a, country: "Dos" })).toThrow(/otra ventana/);
  });

  it("creates saints with unique slugs and reorders characteristics", () => {
    freshDb();
    const base: SaintInput = {
      name: "Santa María Goretti",
      birthYear: 1890,
      birthYearDisplay: "1890",
      ageAtDeath: 11,
      ageAtDeathDisplay: "11 años",
      country: "Italia",
      canonizationYear: null,
      isMartyr: true,
      reviewStatus: "needs_review",
      categories: [],
      patronages: [],
      sources: [],
      characteristics: [
        { id: "a", text: "Primera", type: "biography" },
        { id: "b", text: "Segunda", type: "virtue" },
      ],
      portrait: { focalX: 50, focalY: 50, zoom: 1, fit: "cover" },
    };
    const one = createSaint(base);
    const two = createSaint(base);
    expect(one.id).toBe("santa-maria-goretti");
    expect(two.id).toBe("santa-maria-goretti-2");
    updateSaint(one.id, { ...base, characteristics: [base.characteristics[1], base.characteristics[0]] });
    expect(getSaint(one.id)!.characteristics.map((c) => c.id)).toEqual(["b", "a"]);
  });
});

describe("collections", () => {
  it("references saints through the join table, so edits show up everywhere", async () => {
    freshDb();
    await importLibrary(loadFixture(), "skip");
    const [s1, s2, s3] = loadFixture().saints;
    const c = createCollection("Retiro de jóvenes", [s1.id, s2.id]);
    expect(c.id).toBe("retiro-de-jovenes");
    addToCollection(c.id, [s2.id, s3.id]);
    expect(getCollection(c.id)!.saintIds).toEqual([s1.id, s2.id, s3.id]);

    updateSaint(s1.id, { ...inputFrom(s1.id), name: "Nombre editado" });
    const member = getCollection(c.id)!.saintIds[0];
    expect(getSaint(member)!.name).toBe("Nombre editado");
  });

  it("reorders members, renames, and removes deleted saints from collections", async () => {
    freshDb();
    await importLibrary(loadFixture(), "skip");
    const [s1, s2, s3] = loadFixture().saints;
    const c = createCollection("Orden", [s1.id, s2.id, s3.id]);
    updateCollection(c.id, { name: "Orden nuevo", saintIds: [s3.id, s1.id, s2.id] });
    expect(getCollection(c.id)).toMatchObject({ name: "Orden nuevo", saintIds: [s3.id, s1.id, s2.id] });
    deleteSaint(s1.id);
    expect(getCollection(c.id)!.saintIds).toEqual([s3.id, s2.id]);
    expect(() => updateCollection(c.id, { saintIds: [s2.id, s2.id] })).toThrow(/repetidos/);
    expect(() => updateCollection(c.id, { saintIds: ["fantasma"] })).toThrow(/inexistentes/);
  });

  it("deleting a collection keeps its saints", async () => {
    freshDb();
    await importLibrary(loadFixture(), "skip");
    const first = listCollections()[0];
    deleteCollection(first.id);
    expect(getSaint(first.saintIds[0])).not.toBeNull();
  });

  it("duplicating a saint copies all fields under a new id", async () => {
    freshDb();
    await importLibrary(loadFixture(), "skip");
    const src = loadFixture().saints[0];
    const copy = duplicateSaint(src.id);
    expect(copy.id).toBe(`${src.id}-copia`);
    expect(copy.name).toBe(`${src.name} (copia)`);
    expect(copy.characteristics).toEqual(getSaint(src.id)!.characteristics);
  });
});

describe("bulk review status", () => {
  it("marks many saints reviewed in one go and can revert", async () => {
    const { setReviewStatus } = await import("@/db/repositories/saints");
    freshDb();
    await importLibrary(loadFixture(), "skip");
    const ids = loadFixture().saints.slice(0, 5).map((s) => s.id);
    expect(setReviewStatus([...ids, "no-existe", ids[0]], "reviewed")).toBe(5);
    expect(ids.every((id) => getSaint(id)!.reviewStatus === "reviewed")).toBe(true);
    expect(getSaint(loadFixture().saints[5].id)!.reviewStatus).toBe("needs_review");
    expect(setReviewStatus(ids.slice(0, 2), "needs_review")).toBe(2);
    expect(getSaint(ids[0])!.reviewStatus).toBe("needs_review");
    expect(setReviewStatus([], "reviewed")).toBe(0);
  });
});
