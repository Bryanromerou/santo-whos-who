import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import es from "../../messages/es.json";
import { getSetting, getUiLocale, setSetting, setUiLocale, SETTING_KEYS } from "@/db/repositories/settings";
import { DEFAULT_LOCALE, LOCALES } from "@/i18n/config";
import { AppError, errorResponse } from "@/lib/errors";
import { createBackupZip, parseBackupZip, restoreBackup } from "@/lib/exports/backup";
import { importLibrary } from "@/lib/imports/import-library";
import { parseLibrary, validateLibrary } from "@/lib/imports/validate";
import { clone, freshDb, loadFixture } from "./helpers";

type Tree = { [k: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree)) {
    if (typeof v === "string") out.set(prefix + k, v);
    else for (const [kk, vv] of leaves(v, `${prefix}${k}.`)) out.set(kk, vv);
  }
  return out;
}

describe("message catalogs", () => {
  it("es.json and en.json have identical key sets", () => {
    const esKeys = [...leaves(es).keys()].sort();
    const enKeys = [...leaves(en).keys()].sort();
    expect(enKeys).toEqual(esKeys);
    expect(esKeys.length).toBeGreaterThan(300);
  });

  it("every message is valid ICU in both languages", () => {
    for (const [locale, messages] of [["es", es], ["en", en]] as const) {
      const invalid: string[] = [];
      const t = createTranslator({
        locale,
        messages,
        // Missing argument values are expected here; only syntax errors matter.
        onError: (e) => {
          if (e.code === "INVALID_MESSAGE") invalid.push(e.message);
        },
        getMessageFallback: ({ key }) => key,
      }) as unknown as { (key: string): string; rich: (key: string, v: object) => unknown };
      for (const key of leaves(messages).keys()) t.rich(key, {});
      expect(invalid, locale).toEqual([]);
    }
  });
});

describe("interface language setting", () => {
  it("defaults to English and round-trips through the settings repository", () => {
    const { db } = freshDb(null);
    expect(DEFAULT_LOCALE).toBe("en");
    expect(getUiLocale(db)).toBe("en");
    for (const locale of LOCALES) {
      setUiLocale(locale, db);
      expect(getUiLocale(db)).toBe(locale);
      expect(getSetting(SETTING_KEYS.uiLocale, db)).toBe(locale);
    }
  });

  it("ignores unknown stored values", () => {
    const { db } = freshDb(null);
    setSetting(SETTING_KEYS.uiLocale, "fr", db);
    expect(getUiLocale(db)).toBe("en");
  });

  it("is included in backups and restored with a full replace", async () => {
    const { db } = freshDb("es");
    await importLibrary(loadFixture(), "skip");
    const zip = createBackupZip(db);
    expect(parseBackupZip(zip).settings?.uiLocale).toBe("es");

    const { db: other } = freshDb("en");
    await restoreBackup(zip, "replace", { confirmReplace: true }, other);
    expect(getUiLocale(other)).toBe("es");
  });
});

describe("server messages follow the setting", () => {
  it("renders AppError and response bodies in the chosen language", async () => {
    freshDb("en");
    expect(new AppError("replaceNeedsConfirmation").message).toBe("Replacing the library requires explicit confirmation.");
    expect((await errorResponse(new AppError("saintNotFound", { status: 404 })).json()).error).toBe("The saint doesn't exist or was deleted.");
    freshDb("es");
    const err = new AppError("saintNotFound", { status: 404 });
    expect(err.message).toBe("El santo no existe o fue eliminado.");
    expect(err.messageIn("en")).toBe("The saint doesn't exist or was deleted.");
  });

  it("writes import reports and summaries in English", async () => {
    freshDb("en");
    const f = clone(loadFixture());
    f.saints[1].id = f.saints[0].id;
    expect(validateLibrary(f, "skip").report.errors.join("\n")).toMatch(/appears 2 times in the file/);
    const bad = clone(loadFixture()) as Record<string, unknown>;
    bad.schemaVersion = 2;
    expect(parseLibrary(bad, "en").errors.join("\n")).toContain("schemaVersion must be 1");
    expect((await importLibrary(loadFixture(), "skip")).summary).toBe("43 saints imported · 258 characteristics · 6 collections");
  });

  it("uses Zod's built-in messages in the chosen language", () => {
    const f = clone(loadFixture()) as unknown as { saints: Record<string, unknown>[] };
    f.saints[0].country = 42;
    expect(parseLibrary(f, "es").errors.join("\n")).toMatch(/se esperaba/i);
    expect(parseLibrary(f, "en").errors.join("\n")).toMatch(/expected string/i);
  });
});
