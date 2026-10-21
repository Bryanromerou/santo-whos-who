import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { createSaint, deleteSaint, duplicateSaint, getSaint } from "@/db/repositories/saints";
import { GET as servePortrait } from "@/app/api/portraits/[filename]/route";
import { detectImageFormat, processPortrait } from "@/lib/images/process";
import { cleanupOrphanPortraits, releasePortraitIfUnused, removeSaintPortrait, setSaintPortrait } from "@/lib/images/portrait-service";
import { masterFilename, resolveServeFile, thumbFilename } from "@/lib/images/storage";
import { portraitsDir } from "@/lib/config";
import { freshDb, makeImage } from "./helpers";

const MB = 1024 * 1024;

function newSaint() {
  return createSaint({
    name: "Santo con foto",
    birthYear: null,
    birthYearDisplay: "",
    ageAtDeath: null,
    ageAtDeathDisplay: "",
    country: "",
    canonizationYear: null,
    isMartyr: false,
    reviewStatus: "needs_review",
    categories: [],
    patronages: [],
    sources: [],
    characteristics: [{ id: "x", text: "Texto", type: "other" }],
    portrait: { focalX: 50, focalY: 50, zoom: 1, fit: "cover" },
  });
}

const fileFor = (p: string, thumb = false) => path.join(portraitsDir(), thumb ? thumbFilename(p) : masterFilename(p));

describe("image validation", () => {
  it("detects formats from content, not names", async () => {
    expect(detectImageFormat(await makeImage("jpeg"))).toBe("jpeg");
    expect(detectImageFormat(await makeImage("png"))).toBe("png");
    expect(detectImageFormat(await makeImage("webp"))).toBe("webp");
    expect(detectImageFormat(Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(detectImageFormat(Buffer.from("GIF89a......"))).toBeNull();
  });

  it("rejects disguised, truncated, empty and oversized files", async () => {
    freshDb(); // error messages follow the interface language stored in the DB (Spanish here)
    await expect(processPortrait(Buffer.from("not an image at all"), 10 * MB)).rejects.toThrow(/Formato no admitido/);
    const png = await makeImage("png");
    await expect(processPortrait(png.subarray(0, 40), 10 * MB)).rejects.toThrow();
    await expect(processPortrait(Buffer.alloc(0), 10 * MB)).rejects.toThrow(/vacío/);
    await expect(processPortrait(await makeImage("jpeg"), 100)).rejects.toThrow(/límite/);
  });

  it("re-encodes to JPEG, strips EXIF and builds a thumbnail", async () => {
    const input = await makeImage("jpeg", 3000, 4000, true);
    expect((await sharp(input).metadata()).exif).toBeDefined();
    const out = await processPortrait(input, 10 * MB);
    const meta = await sharp(out.master).metadata();
    expect(meta.format).toBe("jpeg");
    expect(meta.exif).toBeUndefined();
    expect(Math.max(out.width, out.height)).toBe(2400);
    expect(out.width / out.height).toBeCloseTo(0.75, 2); // aspect ratio preserved
    const t = await sharp(out.thumb).metadata();
    expect(Math.max(t.width!, t.height!)).toBe(480);
  });
});

describe("safe serving", () => {
  it("only resolves whitelisted UUID filenames", () => {
    freshDb();
    const ok = "3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e.jpg";
    expect(resolveServeFile(ok)).toBe(path.join(portraitsDir(), ok));
    expect(resolveServeFile(ok.replace(".jpg", ".thumb.jpg"))).not.toBeNull();
    for (const bad of ["../santos.sqlite", "..%2Fsantos.sqlite", "/etc/passwd", "foto.jpg", ok.replace(".jpg", ".png"), `${ok}/..`, `x${ok}`, ok.toUpperCase()]) {
      expect(resolveServeFile(bad)).toBeNull();
    }
  });

  it("route handler returns 404 for traversal and serves real files", async () => {
    freshDb();
    const s = newSaint();
    const saved = await setSaintPortrait(s.id, await makeImage("png"));
    const name = masterFilename(saved.portraitPath!);
    const res = await servePortrait(new Request("http://x"), { params: Promise.resolve({ filename: name }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    const bad = await servePortrait(new Request("http://x"), { params: Promise.resolve({ filename: "../santos.sqlite" }) });
    expect(bad.status).toBe(404);
  });
});

describe("portrait lifecycle", () => {
  it("stores files on disk, only the relative path in SQLite", async () => {
    freshDb();
    const s = newSaint();
    const saved = await setSaintPortrait(s.id, await makeImage("webp"));
    expect(saved.portraitPath).toMatch(/^uploads\/saints\/[0-9a-f-]{36}\.jpg$/);
    expect(fs.existsSync(fileFor(saved.portraitPath!))).toBe(true);
    expect(fs.existsSync(fileFor(saved.portraitPath!, true))).toBe(true);
  });

  it("replacing commits the new image before deleting the old one", async () => {
    freshDb();
    const s = newSaint();
    const first = (await setSaintPortrait(s.id, await makeImage("jpeg"))).portraitPath!;
    const second = (await setSaintPortrait(s.id, await makeImage("png"))).portraitPath!;
    expect(second).not.toBe(first);
    expect(getSaint(s.id)!.portraitPath).toBe(second);
    expect(fs.existsSync(fileFor(second))).toBe(true);
    expect(fs.existsSync(fileFor(first))).toBe(false);
  });

  it("a failed upload leaves the current portrait intact", async () => {
    freshDb();
    const s = newSaint();
    const first = (await setSaintPortrait(s.id, await makeImage("jpeg"))).portraitPath!;
    await expect(setSaintPortrait(s.id, Buffer.from("basura"))).rejects.toThrow();
    expect(getSaint(s.id)!.portraitPath).toBe(first);
    expect(fs.existsSync(fileFor(first))).toBe(true);
  });

  it("keeps a shared file until the last saint using it is gone", async () => {
    freshDb();
    const s = newSaint();
    const p = (await setSaintPortrait(s.id, await makeImage("jpeg"))).portraitPath!;
    const copy = duplicateSaint(s.id);
    expect(copy.portraitPath).toBe(p);
    const { portraitPath } = deleteSaint(s.id);
    releasePortraitIfUnused(portraitPath);
    expect(fs.existsSync(fileFor(p))).toBe(true);
    removeSaintPortrait(copy.id);
    expect(fs.existsSync(fileFor(p))).toBe(false);
  });

  it("cleans up orphan files but never referenced ones", async () => {
    freshDb();
    const s = newSaint();
    const p = (await setSaintPortrait(s.id, await makeImage("jpeg"))).portraitPath!;
    const orphan = path.join(portraitsDir(), "11111111-2222-4333-8444-555555555555.jpg");
    fs.copyFileSync(fileFor(p), orphan);
    expect(cleanupOrphanPortraits(0)).toBe(1);
    expect(fs.existsSync(orphan)).toBe(false);
    expect(fs.existsSync(fileFor(p))).toBe(true);
  });
});
