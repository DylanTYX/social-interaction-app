"use client";

import type { ReactNode } from "react";

import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * One field: a label, its control, and optional helper text.
 *
 * This exists because nothing owned the spacing. There were 23 `<Label>` usages
 * across the setup wizard in six different hand-rolled shapes, and the scale
 * drifted until gaps stopped meaning anything:
 *
 *   - `space-y-2` (8px) was doing four jobs at once — label→control,
 *     control→helper, item→item, and card-title→description.
 *   - Three fields had a label→control gap *identical* to the gap between two
 *     unrelated elements (`loop-step` Label→Select 8px, Select→rubric chips 8px).
 *   - Two label/helper pairs in `finalize-step` had no spacing class at all, so
 *     the gap was whatever the browser's default `<p>` margin happened to be.
 *
 * That is what "everything reads like one long paragraph" actually was: with
 * the biggest ratio anywhere at 2:1, the eye had nothing to separate a field
 * from its neighbour.
 *
 * The contract here is 8px label→control and 6px control→hint, and the caller
 * supplies 24px between fields — a 3:1 ratio, the same one the Settings page
 * already uses without this problem.
 *
 * `hint` also gets a stable id (see `fieldHintId`) so a control can point at it
 * with `aria-describedby`. It cannot be wired here — `children` is arbitrary
 * JSX and reaching into it to inject props breaks the moment a caller wraps
 * their control — so the caller opts in. Worth doing wherever the hint is a
 * validation message rather than a description.
 */
export function Field({
  label,
  htmlFor,
  hint,
  aside,
  className,
  children,
}: {
  label: ReactNode;
  /** Required whenever `label` names a real control — this is the only wiring. */
  htmlFor?: string;
  /** Helper text below the control. Announced via `aria-describedby`. */
  hint?: ReactNode;
  /**
   * Right-aligned content on the label row — a character counter, a length
   * readout. Three sites rebuilt this as their own `flex justify-between`.
   */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const hintId = hint && htmlFor ? `${htmlFor}-hint` : undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {aside}
      </div>
      {children}
      {hint && (
        // 6px, tighter than the 8px above the control, so the hint reads as
        // part of this field rather than as the start of the next one.
        <div
          id={hintId}
          className="mt-1.5 text-xs leading-5 text-muted-foreground"
        >
          {hint}
        </div>
      )}
    </div>
  );
}

/**
 * A titled group of fields.
 *
 * The heading sits 8px above its group and the group's fields are 24px apart,
 * so the heading is unambiguously *part of* what follows. Before this, the
 * three `<section>`s in the round card put their `<h4>` in the same
 * `space-y-4` as the fields — a heading got exactly the same 16px as the gap
 * between two unrelated fields, which is why it stopped reading as a heading.
 *
 * The nesting does the work rather than a negative margin: `space-y-2` for
 * heading→group, `space-y-6` inside the group. Nothing to keep in sync.
 */
export function FieldSection({
  title,
  className,
  children,
}: {
  title: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

/**
 * The id `Field` will give its hint, so a control can point at it.
 *
 * Returned separately rather than cloning the child: `children` here is
 * arbitrary JSX (a Select tree, a Textarea, a slider row), and reaching into it
 * to inject props would break the moment a caller wraps their control.
 */
export function fieldHintId(htmlFor: string): string {
  return `${htmlFor}-hint`;
}
