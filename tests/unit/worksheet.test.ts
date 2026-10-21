import { describe, expect, it } from "vitest";
import { ageDisplay, birthDisplay, toWorksheetSaint } from "@/lib/worksheet/card-data";
import { moveItem, paginate } from "@/lib/worksheet/paginate";
import { coerceConfig, decodeConfig, DEFAULT_SETTINGS, encodeConfig } from "@/lib/worksheet/settings";
import { matchesSearch, normalizeForSearch, slugify } from "@/lib/text";

describe("pagination", () => {
  it("puts two saints per page by default", () => {
    const pages = paginate(["a", "b", "c", "d"], 2);
    expect(pages).toEqual([
      { perPage: 2, slots: ["a", "b"] },
      { perPage: 2, slots: ["c", "d"] },
    ]);
  });

  it("leaves an empty slot rather than dropping a saint", () => {
    expect(paginate(["a", "b", "c"], 2).at(-1)).toEqual({ perPage: 2, slots: ["c", null] });
    expect(paginate(["a", "b", "c", "d", "e"], 4)).toHaveLength(2);
    expect(paginate([], 2)).toEqual([]);
  });

  it("gives 'solo' saints their own page while preserving order", () => {
    const pages = paginate(["a", "b", "c", "d"], 2, ["b"]);
    expect(pages).toEqual([
      { perPage: 2, slots: ["a", null] },
      { perPage: 1, slots: ["b"] },
      { perPage: 2, slots: ["c", "d"] },
    ]);
    const flat = pages.flatMap((p) => p.slots).filter(Boolean);
    expect(flat).toEqual(["a", "b", "c", "d"]);
  });

  it("one-per-page ignores solo flags", () => {
    expect(paginate(["a", "b"], 1, ["a"])).toHaveLength(2);
  });
});

describe("reorder logic", () => {
  it("moves items up, down and to ends", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c", "d"], 3, 0)).toEqual(["d", "a", "b", "c"]);
    expect(moveItem(["a", "b", "c"], 1, 99)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });
});

describe("display rules", () => {
  it("shows imported display text exactly and never invents values", () => {
    expect(birthDisplay({ birthYear: null, birthYearDisplay: "c. 1450 (aprox.)" })).toBe("c. 1450 (aprox.)");
    expect(birthDisplay({ birthYear: 1913, birthYearDisplay: "" })).toBe("1913");
    expect(birthDisplay({ birthYear: null, birthYearDisplay: "" })).toBe("—");
    expect(ageDisplay({ ageAtDeath: 14, ageAtDeathDisplay: "" })).toBe("14 años");
    expect(ageDisplay({ ageAtDeath: null, ageAtDeathDisplay: "entre 30 y 35 años" })).toBe("entre 30 y 35 años");
  });

  it("builds card data without a portrait when there is no file", () => {
    const card = toWorksheetSaint(
      {
        id: "x",
        name: "X",
        birthYear: null,
        birthYearDisplay: "",
        ageAtDeath: null,
        ageAtDeathDisplay: "",
        country: "",
        characteristics: [{ id: "1", text: "t", type: "other" }],
        portrait: { focalX: 50, focalY: 50, zoom: 1, fit: "cover" },
      },
      null,
    );
    expect(card.portrait).toBeNull();
    expect(card.country).toBe("—");
  });
});

describe("config codec", () => {
  it("round-trips accents through base64url", () => {
    const cfg = { saintIds: ["jose-sanchez-del-rio", "niño"], soloSaintIds: [], settings: { ...DEFAULT_SETTINGS, perPage: 1 as const } };
    const enc = encodeConfig(cfg);
    expect(enc).not.toMatch(/[+/=]/);
    expect(decodeConfig(enc)).toEqual(cfg);
    expect(decodeConfig("%%%")).toBeNull();
  });

  it("falls back to defaults for invalid stored settings", () => {
    const c = coerceConfig({ saintIds: ["a", 3], settings: { fontSizePt: 999 } });
    expect(c.saintIds).toEqual(["a"]);
    expect(c.settings).toEqual(DEFAULT_SETTINGS);
  });
});

describe("accent-insensitive search", () => {
  it("matches with or without accents", () => {
    expect(normalizeForSearch("San José Sánchez del Río")).toBe("san jose sanchez del rio");
    expect(matchesSearch("San José Sánchez del Río", "jose sanchez")).toBe(true);
    expect(matchesSearch("San José Sánchez del Río", "Sánchez Río")).toBe(true);
    expect(matchesSearch("San Carlo Acutis", "acutis jose")).toBe(false);
    expect(slugify("Santa Teresa de Ávila")).toBe("santa-teresa-de-avila");
  });
});

describe("worksheet-wide photo fit", () => {
  const p = { src: "/x.jpg", focalX: 20, focalY: 70, zoom: 1.6, fit: "cover" as const };
  it("keeps each saint's crop by default", async () => {
    const { effectivePortrait } = await import("@/lib/worksheet/card-data");
    expect(effectivePortrait(p, "saint")).toEqual(p);
    expect(effectivePortrait(null, "contain")).toBeNull();
  });
  it("'contain' shows the whole photo with no zoom or offset", async () => {
    const { effectivePortrait } = await import("@/lib/worksheet/card-data");
    expect(effectivePortrait(p, "contain")).toEqual({ ...p, fit: "contain", zoom: 1, focalX: 50, focalY: 50 });
  });
  it("'cover' fills the box but keeps the saint's chosen crop position", async () => {
    const { effectivePortrait } = await import("@/lib/worksheet/card-data");
    expect(effectivePortrait({ ...p, fit: "contain" }, "cover")).toEqual({ ...p, fit: "cover" });
  });
  it("older saved settings without photoFit default to per-saint", () => {
    expect(coerceConfig({ saintIds: [], settings: { ...DEFAULT_SETTINGS, photoFit: undefined } }).settings.photoFit).toBe("saint");
  });
});
