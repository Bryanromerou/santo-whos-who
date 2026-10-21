/**
 * Overflow detection shared by the preview and the print/PDF view.
 * A card overflows when any measured region's content is taller than the
 * space it was given. Transforms (preview zoom) don't affect these values.
 */
const TOLERANCE_PX = 1;

export function findOverflowingCards(root: ParentNode): string[] {
  const ids: string[] = [];
  root.querySelectorAll<HTMLElement>("[data-ws-card]").forEach((card) => {
    const regions = card.querySelectorAll<HTMLElement>("[data-ws-measure]");
    let over = card.scrollHeight > card.clientHeight + TOLERANCE_PX;
    regions.forEach((r) => {
      if (r.scrollHeight > r.clientHeight + TOLERANCE_PX) over = true;
    });
    if (over) ids.push(card.dataset.wsCard!);
  });
  return ids;
}

/** Resolves when fonts and all images in `root` have finished loading (or failed). */
export async function waitForAssets(root: ParentNode): Promise<void> {
  if (typeof document !== "undefined" && document.fonts) await document.fonts.ready;
  const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("img"));
  await Promise.all(
    imgs.map((img) =>
      img.complete
        ? img.decode?.().catch(() => undefined)
        : new Promise<void>((resolve) => {
            img.addEventListener("load", () => resolve(), { once: true });
            img.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  );
}
