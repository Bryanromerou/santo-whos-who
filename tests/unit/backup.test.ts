import fs from "node:fs";
import path from "node:path";
import { strToU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { countSaints, getSaint } from "@/db/repositories/saints";
import { portraitsDir } from "@/lib/config";
import { createBackupZip, previewRestore, restoreBackup } from "@/lib/exports/backup";
import { buildLibraryExport } from "@/lib/exports/export-library";
import { importLibrary } from "@/lib/imports/import-library";
import { setSaintPortrait } from "@/lib/images/portrait-service";
import { masterFilename } from "@/lib/images/storage";
import { freshDb, loadFixture, makeImage } from "./helpers";

async function libraryWithPortrait() {
  freshDb();
  await importLibrary(loadFixture(), "skip");
  const id = loadFixture().saints[1].id;
  const saved = await setSaintPortrait(id, await makeImage("jpeg"));
  return { id, portraitPath: saved.portraitPath! };
}

describe("backup ZIP", () => {
  it("contains manifest, library.json and portrait files", async () => {
    const { portraitPath } = await libraryWithPortrait();
    const entries = unzipSync(createBackupZip());
    expect(Object.keys(entries)).toEqual(
      expect.arrayContaining(["manifest.json", "library.json", "settings.json", `portraits/${masterFilename(portraitPath)}`]),
    );
    const manifest = JSON.parse(new TextDecoder().decode(entries["manifest.json"]));
    expect(manifest.counts).toEqual({ saints: 43, characteristics: 258, collections: 6, portraits: 1 });
  });

  it("restores into an empty data folder on another 'computer'", async () => {
    const { id, portraitPath } = await libraryWithPortrait();
    const before = buildLibraryExport();
    const zip = createBackupZip();

    freshDb(); // brand-new data dir
    const preview = previewRestore(zip, "replace");
    expect(preview.report.ok).toBe(true);
    expect(preview.portraits).toBe(1);
    expect(countSaints()).toBe(0); // preview never writes

    const result = await restoreBackup(zip, "replace", { confirmReplace: true });
    expect(result.portraitsRestored).toBe(1);
    expect(buildLibraryExport()).toEqual(before);
    expect(getSaint(id)!.portraitPath).toBe(portraitPath);
    expect(fs.existsSync(path.join(portraitsDir(), masterFilename(portraitPath)))).toBe(true);
  });

  it("refuses to replace without confirmation", async () => {
    await libraryWithPortrait();
    const zip = createBackupZip();
    await expect(restoreBackup(zip, "replace", {})).rejects.toThrow(/confirmación/);
  });

  it("rejects tampered or foreign archives and writes nothing", async () => {
    await libraryWithPortrait();
    const entries = unzipSync(createBackupZip());
    entries["library.json"] = strToU8(new TextDecoder().decode(entries["library.json"]).replace("Santo", "Sant0"));
    const tampered = zipSync(entries);
    freshDb();
    expect(previewRestore(tampered, "replace").report.errors.join(" ")).toMatch(/dañado/);
    await expect(restoreBackup(tampered, "replace", { confirmReplace: true })).rejects.toThrow(/no es válido/);
    expect(countSaints()).toBe(0);
    expect(fs.readdirSync(portraitsDir())).toEqual([]);

    expect(previewRestore(zipSync({ "hola.txt": strToU8("x") }), "skip").report.errors[0]).toMatch(/manifest.json/);
    expect(previewRestore(strToU8("no zip"), "skip").report.errors[0]).toMatch(/No se pudo abrir/);
  });

  it("rejects unsafe file names inside the archive", async () => {
    await libraryWithPortrait();
    const entries = unzipSync(createBackupZip());
    entries["portraits/../../evil.jpg"] = entries[Object.keys(entries).find((k) => k.startsWith("portraits/"))!];
    const zip = zipSync(entries);
    expect(previewRestore(zip, "replace").report.ok).toBe(false);
  });
});
