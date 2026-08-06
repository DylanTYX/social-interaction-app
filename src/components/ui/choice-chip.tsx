"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * A selectable pill: one of a small set of mutually exclusive options.
 *
 * There were four hand-rolled versions of this in the setup wizard, rendering
 * at 38px (practice mode), 34px (the two document pickers' tabs) and 30px
 * (brief quick-starts) — three heights for one idea, none of them matching the
 * 32px `Button size="sm"` sitting beside them, and each re-deciding what
 * "selected" looks like.
 *
 * `Button` is the wrong primitive here despite the resemblance: these are a
 * choice among options, not actions, so the pressed one must be announced as
 * such. Hence `aria-pressed` and a single selected treatment.
 *
 * 32px tall, matching `Button size="sm"`, so a chip row and a button row share
 * a baseline.
 */
export function ChoiceChip({
  selected,
  onClick,
  icon,
  children,
  hint,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  children: ReactNode;
  /** Secondary text inside the chip, e.g. "Type your answers". */
  hint?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-full border px-3 text-sm transition-colors",
        "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
        selected
          ? "border-blue-500 bg-blue-50 text-blue-700"
          : "border-border bg-background text-muted-foreground hover:bg-accent",
        className,
      )}
    >
      {icon}
      <span className="font-medium">{children}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </button>
  );
}
