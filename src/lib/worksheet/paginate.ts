import type { PerPage } from "./settings";

export type WorksheetPage = {
  /** Cards per page used for this page's grid (a "solo" saint gets a full page). */
  perPage: PerPage;
  /** Saint ids in slot order; `null` marks an empty slot. */
  slots: (string | null)[];
};

/**
 * Splits saints into pages, preserving order. Saints in `soloIds` always get
 * a page of their own (used to fix overflow without shrinking everyone).
 * A saint card is never split across pages: each card occupies exactly one slot.
 */
export function paginate(saintIds: string[], perPage: PerPage, soloIds: Iterable<string> = []): WorksheetPage[] {
  const solo = new Set(soloIds);
  const pages: WorksheetPage[] = [];
  let current: (string | null)[] = [];

  const flush = () => {
    if (current.length === 0) return;
    while (current.length < perPage) current.push(null);
    pages.push({ perPage, slots: current });
    current = [];
  };

  for (const id of saintIds) {
    if (perPage > 1 && solo.has(id)) {
      flush();
      pages.push({ perPage: 1, slots: [id] });
      continue;
    }
    current.push(id);
    if (current.length === perPage) flush();
  }
  flush();
  return pages;
}

/** Moves an item from one index to another (returns a new array). */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return [...list];
  const clamped = Math.max(0, Math.min(list.length - 1, to));
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(clamped, 0, item);
  return next;
}
