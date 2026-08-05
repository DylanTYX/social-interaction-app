/**
 * Accent-tile palettes for icon tiles, stat tiles and feature cards.
 *
 * Five near-identical copies of this lookup existed — one of them declared
 * inside a render body, so it was re-allocated on every render, and it was a
 * subset of a map that same file already imported.
 */

export type TileColor =
  | "blue"
  | "purple"
  | "indigo"
  | "green"
  | "orange"
  | "pink"
  | "teal";

/** Background + foreground for a solid accent tile. */
export const TILE_COLORS: Record<TileColor, string> = {
  blue: "bg-blue-100 text-blue-600",
  purple: "bg-purple-100 text-purple-600",
  indigo: "bg-indigo-100 text-indigo-600",
  green: "bg-green-100 text-green-600",
  orange: "bg-orange-100 text-orange-600",
  pink: "bg-pink-100 text-pink-600",
  teal: "bg-teal-100 text-teal-600",
};

/** As above, plus a group-hover deepening for interactive cards. */
export const TILE_COLORS_INTERACTIVE: Record<TileColor, string> = {
  blue: "bg-blue-100 text-blue-600 group-hover:bg-blue-200",
  purple: "bg-purple-100 text-purple-600 group-hover:bg-purple-200",
  indigo: "bg-indigo-100 text-indigo-600 group-hover:bg-indigo-200",
  green: "bg-green-100 text-green-600 group-hover:bg-green-200",
  orange: "bg-orange-100 text-orange-600 group-hover:bg-orange-200",
  pink: "bg-pink-100 text-pink-600 group-hover:bg-pink-200",
  teal: "bg-teal-100 text-teal-600 group-hover:bg-teal-200",
};

/** Matching hover border for a card wrapping one of the tiles above. */
export const TILE_BORDERS: Record<TileColor, string> = {
  blue: "hover:border-blue-200",
  purple: "hover:border-purple-200",
  indigo: "hover:border-indigo-200",
  green: "hover:border-green-200",
  orange: "hover:border-orange-200",
  pink: "hover:border-pink-200",
  teal: "hover:border-teal-200",
};
