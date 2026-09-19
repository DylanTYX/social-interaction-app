import * as React from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-soft",
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        // The action takes its own row below `sm`: beside the title it left a
        // phone-width card with a title column ninety pixels wide.
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 sm:has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A card's title, as a real heading.
 *
 * Upstream shadcn renders this as a `<div>` — deliberately, since a card is not
 * always a section. The cost showed up when the pages were audited: every
 * dashboard page except home had **exactly one heading**, the `h1` in
 * `PageHeader`. Settings has five sections and one heading. The personas grid
 * is twelve cards with nothing to navigate between them. A screen-reader user
 * jumping by heading gets the page title and then nothing.
 *
 * `h2` is the default because almost every page here is `h1` → cards with no
 * section layer in between, so `h2` is right more often than `h3` and never
 * skips a level. Pass `as` where that is wrong: `h3` under a real section
 * heading, `h1` on the auth pages where this *is* the page title, `div` for the
 * few that are labels rather than headings.
 *
 * The tag is visually a no-op — Tailwind's preflight resets `h1`–`h6` to
 * `font-size: inherit; font-weight: inherit`, so call sites that pass flex
 * layout or explicit text sizes behave as before.
 *
 * The face is not: every card title is set in the display face, the same as
 * page and section headings, so a heading reads as a heading on every screen.
 * See docs/DESIGN.md.
 */
function CardTitle({
  className,
  as: Tag = "h2",
  ...props
}: React.ComponentProps<"div"> & { as?: "h1" | "h2" | "h3" | "div" }) {
  return (
    <Tag
      data-slot="card-title"
      className={cn(
        "font-display leading-none font-semibold tracking-tight",
        className,
      )}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "row-start-3 self-start sm:col-start-2 sm:row-span-2 sm:row-start-1 sm:justify-self-end",
        className,
      )}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
