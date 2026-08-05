/**
 * Query-parameter helpers for route handlers.
 */

/**
 * Parse a `limit` query parameter.
 *
 * The three list endpoints each hand-rolled this with drifting bounds (max 50
 * vs 100, default 20 vs 25). The cap matters: it is the only thing stopping a
 * client from asking for the entire table.
 */
export function parseLimit(
  searchParams: URLSearchParams,
  options: { fallback: number; max: number },
): number {
  const raw = Number(searchParams.get("limit"));
  if (!Number.isFinite(raw) || raw <= 0) return options.fallback;
  return Math.min(Math.floor(raw), options.max);
}
