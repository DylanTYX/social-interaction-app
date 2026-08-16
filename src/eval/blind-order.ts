/**
 * Stable, pattern-hiding presentation order for anything shown to a human rater.
 *
 * A hash rather than a shuffle: every rater must receive the *same* sheet so
 * their numbers line up when collated, and a reprint must not renumber.
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
 * `FIXTURES` is grouped by round type and cycles strong/weak/mediocre, so a
 * rater working down it in file order can infer the band from the position
 * without reading the answer.
 */
export function presentationOrder<T extends { id: string }>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => stableHash(a.id) - stableHash(b.id));
}

/**
 * Whether the two arms of a blind A/B swap for this item. Derived from the id,
 * so `--score` can recover which arm was which without the sheet carrying that
 * anywhere a rater could see it.
 */
export function blindSwap(id: string): boolean {
  return stableHash(`swap:${id}`) % 2 === 1;
}
