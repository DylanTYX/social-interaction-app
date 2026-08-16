import type { TileColor } from "@/lib/tile-colors";

/**
 * One accent per document, used on every surface that shows it.
 *
 * Before this, each surface picked its own. The job-description page ran three
 * colours at once — a green header tile, an indigo icon on the add card, green
 * icons on the rows — and the CV page ran a teal header over a purple body. So
 * neither page matched its own heading, and the two pages had no relationship
 * to each other either.
 *
 * These are the values the page headers already declared, which makes the
 * headers right and everything below them wrong. Fixing it in that direction
 * means nothing has to move in the sidebar or on the dashboard.
 */
export const JOB_DESCRIPTION_ACCENT: TileColor = "green";
export const RESUME_ACCENT: TileColor = "teal";
