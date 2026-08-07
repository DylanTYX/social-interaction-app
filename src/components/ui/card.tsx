import * as React from "react";

import { cn } from "@/lib/utils";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
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
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
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
 * Visually a no-op — Tailwind's preflight resets `h1`–`h6` to `font-size:
 * inherit; font-weight: inherit`, so the call sites that pass flex layout or
 * explicit text sizes behave exactly as before.
 */
function CardTitle({
  className,
  as: Tag = "h2",
  ...props
}: React.ComponentProps<"div"> & { as?: "h1" | "h2" | "h3" | "div" }) {
  return (
    <Tag
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
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
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
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

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
};
