/**
 * The identity colours.
 *
 * Seven hues for the things in this app that have an identity and are told
 * apart by it: the six round types, and people. Round types are assigned theirs
 * (`ROUND_TYPE_SPECS[type].accent`); a person's is derived from their name
 * (`tileColorForKey`), so the same interviewer is the same colour on the
 * personas page, in a session row, in the wizard's picker and in a transcript.
 *
 * The two never look alike, because they take different shapes: a round is a
 * **tinted chip** (`TILE_COLORS`, soft ground and coloured text, rounded-md) and
 * a person is a **solid circle** (`TILE_ACCENT` with white initials). Shape says
 * which kind of thing you are looking at; the hue says which one.
 *
 * These are for identity and nothing else. A page, a feature, a chart series or
 * a status does not get one; those are blue, slate, or a semantic colour. See
 * docs/DESIGN.md.
 */

export type TileColor =
  "blue" | "purple" | "indigo" | "green" | "orange" | "pink" | "teal";

/** Soft ground + coloured text: a round's chip. */
export const TILE_COLORS: Record<TileColor, string> = {
  blue: "bg-blue-100 text-blue-600",
  purple: "bg-purple-100 text-purple-600",
  indigo: "bg-indigo-100 text-indigo-600",
  green: "bg-green-100 text-green-600",
  orange: "bg-orange-100 text-orange-600",
  pink: "bg-pink-100 text-pink-600",
  teal: "bg-teal-100 text-teal-600",
};

/**
 * The colour at full strength: a person's avatar, or the edge of a round card.
 * Pair with `text-white`.
 */
export const TILE_ACCENT: Record<TileColor, string> = {
  blue: "bg-blue-600",
  purple: "bg-purple-600",
  indigo: "bg-indigo-600",
  green: "bg-green-600",
  orange: "bg-orange-500",
  pink: "bg-pink-600",
  teal: "bg-teal-600",
};

export const TILE_COLOR_NAMES: TileColor[] = [
  "blue",
  "purple",
  "indigo",
  "green",
  "orange",
  "pink",
  "teal",
];

/**
 * A stable identity colour for a name.
 *
 * Deterministic on the key rather than random or index-based, so a persona
 * keeps its colour after the library is re-sorted ("most recent first"
 * reorders on every save) and across reloads. Two names can collide; that is
 * fine, since the colour is a recognition aid, not an identifier.
 */
export function tileColorForKey(key: string): TileColor {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return TILE_COLOR_NAMES[Math.abs(hash) % TILE_COLOR_NAMES.length];
}
