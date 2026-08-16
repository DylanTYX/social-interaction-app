import type { TileColor } from "@/lib/tile-colors";

/**
 * One accent per document, used **only** on that document's page header icon.
 *
 * Before this existed, each surface picked its own: the job-description page ran
 * three colours at once — a green header tile, an indigo icon on the add card,
 * green icons on the rows — and the CV page ran a teal header over a purple
 * body. The first fix pushed the header's accent down over the whole page,
 * which made each page internally consistent and created a worse problem: the
 * two pages do the same job through the same components, and one rendered green
 * while the other rendered teal. The upload panel especially — one component,
 * one interaction, two colours.
 *
 * So the accent is now scoped to the header tile and nothing else. Below the
 * header, both pages are the primary blue, because that is the app's one
 * interaction colour. Colour says what a page *is*; blue says what you can
 * *do*.
 *
 * If you are reaching for one of these to tint a card, an icon or a panel:
 * don't. Use `text-primary` / `bg-primary-muted`. The only correct consumer is
 * `PageHeader`'s `iconColor`.
 */
export const JOB_DESCRIPTION_ACCENT: TileColor = "green";
export const RESUME_ACCENT: TileColor = "teal";
