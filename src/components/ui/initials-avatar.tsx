import { initialsFromName } from "@/lib/format";
import { TILE_ACCENT, tileColorForKey } from "@/lib/tile-colors";
import { cn } from "@/lib/utils";

/**
 * Someone's initials, in their identity colour.
 *
 * There were six independent implementations of this at three sizes and two
 * radii; this is the one. The colour is derived from the name, so Sarah Chen
 * is the same colour on the personas page, in a session row, in the picker and
 * in a transcript, and you can pick her out of a grid without reading. It is a
 * solid circle with white initials, which is what tells a person apart from a
 * round's tinted chip in the same hue. See docs/DESIGN.md, "Colour".
 *
 * `tone="you"` is for the signed-in user's own avatar: navy, the brand's dark,
 * rather than a hue. You are not one of the interviewers.
 */

const SIZES = {
  sm: "h-9 w-9 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
} as const;

export function InitialsAvatar({
  name,
  size = "md",
  /** Rounded-full for people in a list; rounded-xl for a card's header. */
  shape = "circle",
  tone = "identity",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  shape?: "circle" | "square";
  tone?: "identity" | "you";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center font-display font-semibold text-white",
        shape === "circle" ? "rounded-full" : "rounded-xl",
        SIZES[size],
        tone === "you" ? "bg-navy" : TILE_ACCENT[tileColorForKey(name)],
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
