import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

const ROOT = path.resolve(__dirname, "../..");
const SEED = path.join(ROOT, "seed/santos_studio_43_santos.json");
const LIBRARY_FILE = fs.existsSync(SEED) ? SEED : path.join(ROOT, "tests/fixtures/library-43.json");
const library = JSON.parse(fs.readFileSync(LIBRARY_FILE, "utf8"));
const OUT = path.join(ROOT, "test-results/e2e-artifacts");

const JOSE = library.saints.find((s: { name: string }) => s.name.includes("Sánchez del Río"));
const CARLO = library.saints.find((s: { name: string }) => s.name.includes("Carlo Acutis"));
const FOUR = [JOSE.id, CARLO.id, library.saints[0].id, library.saints[2].id];

test.describe.configure({ mode: "serial" });

test.beforeAll(() => fs.mkdirSync(OUT, { recursive: true }));

function pdfPageCount(buf: Buffer): number {
  return (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

async function libraryExport(page: Page) {
  const res = await page.request.get("/api/export/json");
  expect(res.ok()).toBe(true);
  return res.json();
}

test("1–3. empty library → import JSON through the UI → 43 saints, 258 characteristics, 6 collections", async ({ page }) => {
  await page.goto("/santos");
  await expect(page.getByText("Tu biblioteca está vacía")).toBeVisible();

  await page.goto("/configuracion/importar");
  await page.getByTestId("import-file-input").setInputFiles(LIBRARY_FILE);
  await expect(page.getByText("Al importar:")).toBeVisible();
  await expect(page.getByText("43 santos nuevos")).toBeVisible();
  await page.getByRole("button", { name: "Importar", exact: true }).click();
  await expect(page.getByTestId("import-summary")).toHaveText("43 santos importados · 258 características · 6 colecciones");

  const exported = await libraryExport(page);
  expect(exported.saints).toHaveLength(43);
  expect(exported.saints.reduce((n: number, s: { characteristics: unknown[] }) => n + s.characteristics.length, 0)).toBe(258);
  expect(exported.collections).toHaveLength(6);
  for (const s of exported.saints) expect(s.characteristics.length).toBeGreaterThan(0);
  // Text preserved exactly.
  expect(exported.saints.map((s: { characteristics: unknown }) => s.characteristics)).toEqual(
    library.saints.map((s: { characteristics: unknown }) => s.characteristics),
  );

  await page.goto("/santos");
  await expect(page.getByText("43 santos", { exact: false }).first()).toBeVisible();
  await expect(page.getByTestId("saint-row")).toHaveCount(43);
  await page.goto("/colecciones");
  await expect(page.getByTestId("collections-list").locator("li")).toHaveCount(6);
});

test("4. accent-insensitive search shows Spanish accents correctly", async ({ page }) => {
  await page.goto("/santos");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Buscar santos").fill("jose sanchez del rio");
  await expect(page.getByTestId("saint-row")).toHaveCount(1);
  await expect(page.getByRole("link", { name: "San José Sánchez del Río", exact: true })).toBeVisible();
  await page.getByLabel("Buscar santos").fill("Sánchez Río");
  await expect(page.getByRole("link", { name: "San José Sánchez del Río", exact: true })).toBeVisible();
});

test("5. edit a bullet of San Carlo Acutis, save, refresh, persists", async ({ page }) => {
  await page.goto(`/santos/${CARLO.id}`);
  await page.waitForLoadState("networkidle"); // let React hydrate before typing
  const first = page.getByLabel("Texto de la característica 1");
  const edited = `${CARLO.characteristics[0].text} (editado en prueba: ñ, á, «»)`;
  await first.fill(edited);
  await expect(first).toHaveValue(edited);
  await expect(page.getByText("Cambios sin guardar")).toBeVisible();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Texto de la característica 1")).toHaveValue(edited);

  // Reorder with the keyboard-friendly buttons and save.
  const second = await page.getByLabel("Texto de la característica 2").inputValue();
  await page.getByRole("button", { name: "Subir característica 2" }).click();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Texto de la característica 1")).toHaveValue(second);
  await expect(page.getByLabel("Texto de la característica 2")).toHaveValue(edited);
});

test("6. upload a portrait, refresh, it displays and prints", async ({ page }) => {
  const png = path.join(OUT, "retrato-prueba.png");
  await sharp({ create: { width: 900, height: 1200, channels: 3, background: { r: 70, g: 110, b: 160 } } })
    .composite([{ input: Buffer.from('<svg width="900" height="1200"><circle cx="450" cy="420" r="230" fill="#f2d7b6"/><rect x="200" y="700" width="500" height="500" fill="#2b3a55"/></svg>') }])
    .png()
    .toFile(png);

  await page.goto(`/santos/${CARLO.id}`);
  await page.waitForLoadState("networkidle");
  await page.getByTestId("portrait-input").setInputFiles(png);
  await expect(page.getByText("Retrato subido")).toBeVisible();
  await page.reload();
  await page.waitForLoadState("networkidle");
  const img = page.getByAltText("Retrato actual");
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

  // Thumbnail shows in the library.
  await page.goto("/santos");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Buscar santos").fill("Acutis");
  const thumb = page.getByTestId("saint-row").locator("img");
  await expect(thumb).toBeVisible();
  expect(await thumb.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

  // Path traversal is rejected by the image route.
  expect((await page.request.get("/api/portraits/..%2Fsantos.sqlite")).status()).toBe(404);
});

test("7–8. four saints → exactly two pages; PDF and print view match, no clipping, image renders", async ({ page }) => {
  await page.goto(`/crear-fichas?ids=${FOUR.join(",")}`);
  await expect(page.getByTestId("page-count")).toContainText("2 páginas");
  await expect(page.getByTestId("fit-ok")).toBeVisible();
  await page.screenshot({ path: path.join(OUT, "builder.png") });

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar PDF" }).click();
  const download = await downloadPromise;
  const pdfPath = path.join(OUT, "fichas.pdf");
  await download.saveAs(pdfPath);
  const pdf = fs.readFileSync(pdfPath);
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdfPageCount(pdf)).toBe(2);
  expect(pdf.toString("latin1")).toMatch(/\/MediaBox\s*\[0 0 612 792\]/); // US Letter
  expect(pdf.toString("latin1")).toMatch(/\/Subtype\s*\/Image/); // portrait embedded
  await expect(page.getByText("PDF descargado")).toBeVisible();

  // Native print uses the same view: same pages, no overflow, image loaded.
  await page.emulateMedia({ media: "print" });
  await page.goto("/imprimir");
  await page.waitForSelector("html[data-ws-ready='true']");
  await expect(page.locator(".ws-page")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.dataset.wsOverflow)).toBe("[]");
  const printImg = page.locator(".ws-portrait img");
  await expect(printImg).toHaveCount(1);
  expect(await printImg.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator(".ws-portrait-empty")).toHaveCount(3);
  await page.emulateMedia({ media: "screen" });
  await page.screenshot({ path: path.join(OUT, "print-view.png"), fullPage: true });
});

test("overflow is detected, named, blocks export, and one-per-page fixes it", async ({ page }) => {
  // Make one saint far too long for half a page (through the real API).
  const saint = (await (await page.request.get(`/api/saints/${JOSE.id}`)).json()).saint;
  const long = Array.from({ length: 9 }, (_, i) => ({
    id: `largo-${i}`,
    text: `Viñeta larga de prueba número ${i + 1}: texto suficientemente extenso para ocupar varias líneas en la ficha impresa y comprobar que nunca se corta en silencio.`,
    type: "biography",
  }));
  const put = await page.request.put(`/api/saints/${JOSE.id}`, {
    data: { ...saint, characteristics: [...saint.characteristics, ...long], expectedUpdatedAt: saint.updatedAt },
  });
  expect(put.ok()).toBe(true);

  await page.goto(`/crear-fichas?ids=${FOUR.join(",")}`);
  const warning = page.getByTestId("overflow-warning");
  await expect(warning).toBeVisible();
  await expect(warning).toContainText("San José Sánchez del Río");
  await expect(page.getByRole("button", { name: "Descargar PDF" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Imprimir" })).toBeDisabled();

  // Server refuses too (never exports clipped content).
  const pdfRes = await page.request.post("/api/pdf", { data: { saintIds: FOUR, soloSaintIds: [], settings: {} } });
  expect(pdfRes.status()).toBe(422);
  expect((await pdfRes.json()).details.overflow).toContain(JOSE.id);

  await page.getByRole("button", { name: "Una página para este santo" }).click();
  await expect(page.getByTestId("fit-ok")).toBeVisible();
  await expect(page.getByRole("button", { name: "Descargar PDF" })).toBeEnabled();

  // Restore the original text for the next test.
  const again = (await (await page.request.get(`/api/saints/${JOSE.id}`)).json()).saint;
  await page.request.put(`/api/saints/${JOSE.id}`, { data: { ...again, characteristics: saint.characteristics } });
});

test("9. export JSON + backup ZIP, restore into an empty library, same records and order", async ({ page }) => {
  const before = await libraryExport(page);

  await page.goto("/configuracion");
  const jsonDl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar JSON" }).click();
  const jsonPath = path.join(OUT, "biblioteca.json");
  await (await jsonDl).saveAs(jsonPath);
  expect(JSON.parse(fs.readFileSync(jsonPath, "utf8"))).toEqual(before);

  const zipDl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar respaldo ZIP" }).click();
  const zipPath = path.join(OUT, "respaldo.zip");
  await (await zipDl).saveAs(zipPath);

  // Empty the library (replace with an empty file — requires explicit confirmation).
  const empty = { ...before, saints: [], collections: [] };
  expect((await page.request.post("/api/import", { data: { data: empty, mode: "replace", dryRun: false } })).status()).toBe(400);
  expect((await page.request.post("/api/import", { data: { data: empty, mode: "replace", dryRun: false, confirmReplace: true } })).ok()).toBe(true);
  expect((await libraryExport(page)).saints).toHaveLength(0);

  // Restore the backup through the UI.
  await page.goto("/configuracion");
  await page.getByTestId("restore-input").setInputFiles(zipPath);
  await expect(page.getByText("Al importar:")).toBeVisible();
  await page.getByRole("button", { name: "Restaurar y reemplazar biblioteca…" }).click();
  await page.getByLabel("Escribe REEMPLAZAR para confirmar").fill("REEMPLAZAR");
  await page.getByRole("button", { name: "Reemplazar biblioteca" }).click();
  await expect(page.getByText("43 santos importados · 258 características · 6 colecciones").first()).toBeVisible();

  const after = await libraryExport(page);
  expect(after).toEqual(before);
  // The portrait file came back too.
  const withPortrait = after.saints.find((s: { id: string }) => s.id === CARLO.id);
  const file = withPortrait.portraitPath.split("/").pop();
  expect((await page.request.get(`/api/portraits/${file}`)).ok()).toBe(true);
});

test("review status: bulk mark as reviewed from the library, and one-click from the editor", async ({ page }) => {
  const pendingBefore = (await libraryExport(page)).saints.filter((s: { reviewStatus: string }) => s.reviewStatus === "needs_review").length;

  await page.goto("/santos");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Buscar santos").fill("San Juan");
  const visible = await page.getByTestId("saint-row").count();
  expect(visible).toBeGreaterThan(1);
  await page.getByLabel("Seleccionar todos los visibles").click();
  await page.getByRole("button", { name: "Revisión", exact: true }).click();
  await page.getByRole("menuitem", { name: "Marcar como revisados…" }).click();
  await page.getByRole("button", { name: "Marcar como revisados" }).click();
  await expect(page.getByText(`${visible} santos marcados como revisados`)).toBeVisible();

  let saints = (await libraryExport(page)).saints;
  const juanes = saints.filter((s: { name: string }) => s.name.startsWith("San Juan"));
  expect(juanes.every((s: { reviewStatus: string }) => s.reviewStatus === "reviewed")).toBe(true);
  expect(saints.filter((s: { reviewStatus: string }) => s.reviewStatus === "needs_review")).toHaveLength(pendingBefore - visible);

  // Editor banner button marks a single saint as reviewed and saves.
  const pending = saints.find((s: { reviewStatus: string }) => s.reviewStatus === "needs_review");
  await page.goto(`/santos/${pending.id}`);
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Marcar como revisado", exact: true }).click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();
  await expect(page.getByText("Pendiente de revisión histórica")).toBeHidden();
  await page.reload();
  await expect(page.getByText("Pendiente de revisión histórica")).toBeHidden();
  saints = (await libraryExport(page)).saints;
  expect(saints.find((s: { id: string }) => s.id === pending.id).reviewStatus).toBe("reviewed");
});

test("bulk portrait import: exact names map automatically; near names and duplicates go to a review modal", async ({ page }) => {
  const dir = path.join(OUT, "retratos");
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const img = (color: { r: number; g: number; b: number }) => sharp({ create: { width: 300, height: 400, channels: 3, background: color } });
  await img({ r: 200, g: 60, b: 60 }).png().toFile(path.join(dir, "San José de Cupertino.png")); // exact
  await img({ r: 60, g: 160, b: 60 }).gif().toFile(path.join(dir, "Santa Josefina Bakhita.gif")); // exact, GIF converted in browser
  await img({ r: 60, g: 60, b: 200 }).jpeg().toFile(path.join(dir, "San Juan Boscoo.jpg")); // near name → review
  await img({ r: 220, g: 180, b: 40 }).jpeg().toFile(path.join(dir, "Santa Jacinta Marto.jpg")); // exact …
  await img({ r: 40, g: 180, b: 200 }).webp().toFile(path.join(dir, "Santa Jacinta Martto.webp")); // … plus a near duplicate
  await img({ r: 120, g: 120, b: 120 }).png().toFile(path.join(dir, "Padre Pio.png")); // not in the library
  fs.writeFileSync(path.join(dir, "notas.txt"), "no es una imagen");

  await page.goto("/santos/importar-retratos");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("portraits-files-input").setInputFiles(fs.readdirSync(dir).map((f) => path.join(dir, f)));

  // The review modal opens by itself with one duplicate group and one near match.
  const dialog = page.getByRole("dialog", { name: "Revisar coincidencias" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId("duplicate-group")).toHaveCount(1);
  await expect(dialog.getByTestId("duplicate-group")).toContainText("Santa Jacinta Marto");
  await expect(dialog.getByTestId("fuzzy-item")).toHaveCount(1);
  await expect(dialog.getByTestId("fuzzy-item")).toContainText("San Juan Bosco");
  await expect(page.getByTestId("portrait-summary")).toContainText("1 archivo ignorado");
  await dialog.getByRole("button", { name: "Confirmar" }).click();

  await page.getByRole("button", { name: "Importar 4 retratos" }).click();
  await expect(page.getByText("4 retratos importados").first()).toBeVisible({ timeout: 30_000 });

  const saints = (await libraryExport(page)).saints as { name: string; portraitPath: string | null }[];
  const has = (name: string) => !!saints.find((s) => s.name === name)?.portraitPath;
  for (const n of ["San José de Cupertino", "Santa Josefina Bakhita", "San Juan Bosco", "Santa Jacinta Marto"]) expect(has(n), n).toBe(true);
  // The exact-name file won the duplicate group (yellow), not the near-name one.
  const jacinta = saints.find((s) => s.name === "Santa Jacinta Marto")!;
  const file = await page.request.get(`/api/portraits/${jacinta.portraitPath!.split("/").pop()}`);
  const { dominant } = await sharp(await file.body()).stats();
  expect(dominant.r).toBeGreaterThan(150);
  expect(dominant.b).toBeLessThan(120);
});
