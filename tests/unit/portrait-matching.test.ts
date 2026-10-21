import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { duplicateGroups, fileBaseName, isImageFileName, matchFile, nameSimilarity, normalizeName } from "@/lib/portrait-matching";
import { loadFixture } from "./helpers";

describe("portrait name matching", () => {
  it("normalizes accents, case, punctuation and spacing", () => {
    expect(normalizeName("  Santa María  Goretti ")).toBe("santa maria goretti");
    expect(fileBaseName("dir/San Gabriel de la Dolorosa .jpg")).toBe("San Gabriel de la Dolorosa");
    expect(nameSimilarity("Santa Monica", "Santa Mónica")).toBe(1);
    expect(nameSimilarity("Juan Bosco", "San Juan Bosco")).toBe(1);
    expect(isImageFileName("x.JPG")).toBe(true);
    expect(isImageFileName("Saints WorkSheet.docx")).toBe(false);
  });

  it("flags near names (≥80 %) for review instead of mapping them", () => {
    const saints = [{ id: "jose", name: "San José Sánchez del Río" }, { id: "bosco", name: "San Juan Bosco" }];
    const m = matchFile("San Juan Sanchez del Rio.webp", saints);
    expect(m.kind).toBe("fuzzy");
    expect(m.saintId).toBe("jose");
    expect(m.score).toBeGreaterThanOrEqual(0.8);
    expect(m.score).toBeLessThan(1);
  });

  it("treats accent/case/spacing differences as exact", () => {
    const saints = [{ id: "goretti", name: "Santa María Goretti" }, { id: "gabriel", name: "San Gabriel de la Dolorosa" }];
    expect(matchFile("Santa Maria Goretti.webp", saints)).toMatchObject({ kind: "exact", saintId: "goretti" });
    expect(matchFile("SAN GABRIEL DE LA DOLOROSA .JPG", saints)).toMatchObject({ kind: "exact", saintId: "gabriel" });
  });

  it("leaves unrelated names unassigned", () => {
    const saints = [{ id: "agustin", name: "San Agustín de Hipona" }];
    expect(matchFile("Saint Augustine.jpg", saints).kind).toBe("none");
    expect(matchFile("Padre Pio.png", saints).kind).toBe("none");
  });

  it("handles the local images/Saints folder (whatever it contains) without hard-coded names", () => {
    // images/ is gitignored and only exists on the user's computer; skip elsewhere.
    const dir = path.resolve("images/Saints");
    if (!fs.existsSync(dir)) return;
    const saints = loadFixture().saints.map((s) => ({ id: s.id, name: s.name }));
    const files = fs.readdirSync(dir).filter((f) => !f.startsWith(".") && isImageFileName(f));
    for (const f of files) {
      const m = matchFile(f, saints);
      // Exact means the names really are the same once accents/case/spacing are ignored.
      if (m.kind === "exact") expect(normalizeName(fileBaseName(f))).toBe(normalizeName(saints.find((s) => s.id === m.saintId)!.name));
      if (m.kind === "fuzzy") expect(m.score).toBeGreaterThanOrEqual(0.8);
      if (m.kind === "none") expect(m.saintId).toBeNull();
    }
  });

  it("groups several images that point to the same saint", () => {
    const saints = [{ id: "jose", name: "San José Sánchez del Río" }, { id: "carlo", name: "San Carlo Acutis" }];
    const results = ["San José Sánchez del Río.jpg", "San Juan Sanchez del Rio.webp", "San Carlo Acutis.png"].map((f) => ({ key: f, ...matchFile(f, saints) }));
    expect(results.map((r) => r.kind)).toEqual(["exact", "fuzzy", "exact"]);
    expect([...duplicateGroups(results).entries()]).toEqual([["jose", ["San José Sánchez del Río.jpg", "San Juan Sanchez del Rio.webp"]]]);
  });
});
