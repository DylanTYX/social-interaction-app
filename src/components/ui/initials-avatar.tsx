import { initialsFromName } from "@/lib/format";
import { TILE_COLORS, tileColorForKey } from "@/lib/tile-colors";
import { cn } from "@/lib/utils";

/**
 * Someone's initials, in a colour derived from their name.
 *
 * There were six independent implementations of this — the personas page, the
 * sessions page, the dashboard home, the chat transcript, the setup wizard and
 * the sidebar — at three sizes (h-10 / h-11 / h-14), two radii, and with **two
 * different ideas about what the colour means**:
 *
 *   - The wizard derived it from the name, so Sarah Chen was always the same
 *     colour and you could pick her out of six cards without reading.
 *   - Everywhere else used one fixed gradient for every avatar, so six personas
 *     were six identical purple squares and every session row was the same
 *     blue. The colour was decoration wearing identity's clothes.
 *
 * The name-derived version wins because it does a job: the same interviewer is
 * recognisable on the personas page, in a session row and in the picker, and
 * that only works if all three agree.
 *
 * `tileColorForKey` is deterministic, so the colour survives a re-sort and a
 * reload. Two names can collide, which is fine — this is a recognition aid, not
 * an identifier.
 */

const SIZES = {
  sm: "h-9 w-9 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
} as const;

export function InitialsAvatar({
  name,
  size = "md",
  /** Rounded-full for people in a list; rounded-xl for a card's header tile. */
  shape = "circle",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  shape?: "circle" | "square";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center font-semibold",
        shape === "circle" ? "rounded-full" : "rounded-xl",
        SIZES[size],
        TILE_COLORS[tileColorForKey(name)],
        className,
      )}
      // The initials are a visual shorthand for a name that is always rendered
      // beside them, so announcing them would just repeat it as gibberish.
      aria-hidden
    >
      {initialsFromName(name)}
    </div>
  );
}
