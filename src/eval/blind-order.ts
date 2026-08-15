/**
 * Stable, pattern-hiding presentation order for anything shown to a human rater.
 *
 * Lifted out of `run-rater-sheet.ts`, where it was private, because the coach
 * harness needs the same guarantee for a different sheet: `--sheet` prints the
 * candidate's answer and the coach's rewrite as **A** and **B**, and if the
 * coach's version were always B every marker would work that out inside three
 * items and the win rate would measure nothing.
 *
 * A hash rather than a shuffle, for the reason the original states: every rater
 * must receive the *same* sheet so their numbers line up when collated, and a
 * re-print after a crash must not renumber.
 */

/** FNV-1a. Any stable spread will do; this one is short and dependency-free. */
export function stableHash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * Order items so the sheet's sequence carries no information about the labels.
 *
 * `FIXTURES` is grouped by round type and cycles strong/weak/mediocre, so a
 * rater working down it in file order can infer the intended band from the
 * position without reading the answer.
 */
export function presentationOrder<T extends { id: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => stableHash(a.id) - stableHash(b.id));
}

/**
 * Whether the two arms of a blind A/B should be swapped for this item.
 *
 * Derived from the item's own id, so it is stable across reprints and across
 * the `--sheet` / `--score` pair — the scorer has to be able to recover which
 * arm was which without the sheet carrying that information anywhere a rater
 * could see it.
 */
export function blindSwap(id: string): boolean {
  return stableHash(`swap:${id}`) % 2 === 1;
}
