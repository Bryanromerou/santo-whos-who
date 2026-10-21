import "server-only";
import type { Browser } from "playwright";
import { AppError } from "@/lib/errors";

type Holder = { browser?: Promise<Browser>; idleTimer?: NodeJS.Timeout };
const g = globalThis as unknown as { __santosPdf?: Holder };
const holder: Holder = (g.__santosPdf ??= {});
const IDLE_CLOSE_MS = 2 * 60_000;

async function launch(): Promise<Browser> {
  const { chromium } = await import("playwright");
  try {
    return await chromium.launch({ headless: true });
  } catch (first) {
    // Fall back to an installed Google Chrome if Playwright's Chromium isn't downloaded.
    try {
      return await chromium.launch({ headless: true, channel: "chrome" });
    } catch {
      throw new AppError("chromiumMissing", { status: 503, details: String((first as Error).message).split("\n")[0] });
    }
  }
}

async function getBrowser(): Promise<Browser> {
  if (holder.idleTimer) clearTimeout(holder.idleTimer);
  holder.idleTimer = setTimeout(async () => {
    const b = holder.browser;
    holder.browser = undefined;
    (await b?.catch(() => undefined))?.close().catch(() => undefined);
  }, IDLE_CLOSE_MS);
  holder.idleTimer.unref?.();

  if (holder.browser) {
    const b = await holder.browser.catch(() => undefined);
    if (b?.isConnected()) return b;
  }
  holder.browser = launch();
  holder.browser.catch(() => (holder.browser = undefined));
  return holder.browser;
}

export type PdfOverflow = { saintIds: string[] };

/**
 * Opens the print view (same component + CSS as the preview) in headless
 * Chromium, waits for fonts/images and the overflow check, then prints to a
 * vector PDF using the page size from the CSS `@page` rule.
 */
export async function renderWorksheetPdf(printUrl: string): Promise<Buffer> {
  const browser = await getBrowser();
  const context = await browser.newContext({ deviceScaleFactor: 2 });
  try {
    const page = await context.newPage();
    // Measure overflow under print media, i.e. exactly the layout that gets printed.
    await page.emulateMedia({ media: "print" });
    const res = await page.goto(printUrl, { waitUntil: "load", timeout: 60_000 });
    if (!res || !res.ok()) throw new AppError("printViewFailed", { status: 502, values: { status: res?.status() ?? "unknown" } });
    await page.waitForSelector("html[data-ws-ready='true']", { timeout: 60_000 });

    const state = await page.evaluate(() => ({
      overflow: JSON.parse(document.documentElement.dataset.wsOverflow || "[]") as string[],
      brokenImages: Array.from(document.images).filter((i) => !i.complete || i.naturalWidth === 0).length,
      pages: document.querySelectorAll(".ws-page").length,
    }));
    if (state.overflow.length) {
      throw new AppError("cardsOverflow", { status: 422, details: { overflow: state.overflow } });
    }
    if (state.brokenImages) throw new AppError("imagesFailed", { status: 500 });
    if (state.pages === 0) throw new AppError("noPages");

    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, displayHeaderFooter: false });
    return Buffer.from(pdf);
  } finally {
    await context.close().catch(() => undefined);
  }
}
