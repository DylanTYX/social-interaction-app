import { cn } from "@/lib/utils";
import { CONTENT_ENTER } from "@/lib/motion";
import { Skeleton } from "@/components/ui/skeleton";
import type { ModelAnswerResult } from "@/lib/coach-contract";

/**
 * The rendered output of `/api/coach/model-answer`.
 *
 * Written twice before this, near-identically: the drills page and the report
 * transcript's `TurnCoaching` disclosure. They had already diverged on palette
 * — `amber-700`/`gray-700` against `amber-800`/`slate-700` — which is drift
 * with no reason behind it rather than two considered choices.
 *
 * Unified on the report's values rather than splitting the difference with a
 * `tone` prop. The report renders on `bg-amber-50/60` and drills on white;
 * `amber-800` clears AA on both, `amber-700` only on white. So one palette is
 * not a compromise here, it is the correct one, and a prop would be two
 * branches earning nothing.
 *
 * No `"use client"`: no hooks, no handlers. Both current callers are already
 * client components, and leaving this one unmarked keeps it usable from a
 * server component if a third caller ever wants it.
 */

/** Shared by the labels in both this file's components. */
const LABEL = "text-xs font-semibold uppercase tracking-wide text-amber-800";
const BODY = "mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700";

/**
 * The before/after pair's two panels.
 *
 * The right-hand string is lifted from the report disclosure's own container, so
 * "coaching is amber" carries across from a panel the user has already seen.
 */
const PANEL_ORIGINAL = "rounded-xl border border-gray-200 bg-gray-50/60 p-4";
const PANEL_REWRITE = "rounded-xl border border-amber-200 bg-amber-50/60 p-4";

/**
 * Two columns once the *container* is wide, not the viewport.
 *
 * This distinction is load-bearing. In the report, this component renders inside
 * `w-full max-w-2xl` — a ~640px box that sits on a viewport wide enough to
 * satisfy any `md:` or `lg:` query, so a viewport breakpoint would split a
 * 640px box into two 300px columns. Container queries are core in Tailwind v4
 * and `card.tsx` already uses a named one.
 *
 * `@3xl` (768px) rather than `@2xl` (672px): at `@2xl` a ~1100px viewport
 * produces ~350px columns, roughly 50 characters, which is too narrow to read
 * two passages side by side. `@3xl` keeps every two-column instance at ≥376px.
 */
const COMPARE_GRID = "grid gap-4 @3xl/coaching:grid-cols-2";

/**
 * `h3` rather than `p` for the section labels, for the reason `CardTitle`
 * already argues: these pages had almost no headings, so a screen-reader user
 * jumping by heading got the page title and then nothing. Both call sites render
 * this under an `h2` (`CardTitle`), so `h3` is the right level and skips none.
 * Preflight resets it to inherited size and weight, and both classes here are
 * explicit, so it is a visual no-op.
 */
function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <h3 className={cn(LABEL, className)}>{children}</h3>;
}

export function CoachingResult({
  result,
  originalAnswer,
  className,
}: {
  result: ModelAnswerResult;
  /**
   * The answer that produced `result`, rendered beside the rewrite as a
   * before/after pair.
   *
   * Pass it only where the original is not already on screen. The report
   * transcript shows the answer in a bubble directly above this, so it omits it
   * and the rewrite renders alone — a pair there would duplicate the bubble and
   * put an amber panel on an amber background.
   *
   * Optional rather than paired with a `compare` boolean so that "compare on,
   * nothing to compare" cannot be expressed.
   */
  originalAnswer?: string;
  className?: string;
}) {
  const compare = Boolean(originalAnswer?.trim());

  return (
    // `space-y-4` is the default rhythm; the report's tighter disclosure passes
    // `space-y-3`. `cn` is twMerge and `space-y` is one of its groups, so the
    // override lands without a prop.
    <div className={cn("@container/coaching space-y-4", CONTENT_ENTER, className)}>
      {result.tips.length > 0 && (
        <section>
          <SectionLabel>What to improve</SectionLabel>
          <ul className="mt-1 max-w-prose list-disc space-y-1 pl-4 text-sm leading-relaxed text-slate-700">
            {result.tips.map((tip, index) => (
              <li key={index}>{tip}</li>
            ))}
          </ul>
        </section>
      )}

      {result.rewrite &&
        (compare ? (
          // Original first in source order, so before → after reads correctly
          // both across at `@3xl` and down below it.
          //
          // Grid stretch is wanted here and is not the bug this component was
          // built to fix: these two panels hold the same text twice, once as
          // written and once tightened, so their heights track each other.
          <section className={COMPARE_GRID}>
            <div className={PANEL_ORIGINAL}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Your answer
              </h3>
              <p className={BODY}>{originalAnswer}</p>
            </div>
            <div className={PANEL_REWRITE}>
              <SectionLabel>Your answer, tightened</SectionLabel>
              <p className={BODY}>{result.rewrite}</p>
            </div>
          </section>
        ) : (
          <section>
            <SectionLabel>Your answer, tightened</SectionLabel>
            <p className={cn(BODY, "max-w-prose")}>{result.rewrite}</p>
          </section>
        ))}

      {result.modelAnswer && (
        <section>
          <SectionLabel>Model answer</SectionLabel>
          <p className={cn(BODY, "max-w-prose")}>{result.modelAnswer}</p>
        </section>
      )}
    </div>
  );
}

/**
 * The loading placeholder for `CoachingResult`.
 *
 * Deliberately in the same file as the thing it stands in for. The version this
 * replaces was four generic bars that looked nothing like what arrived, so the
 * skeleton→result swap reflowed the page every time. Reproducing the real
 * structure — including the pair and its container query — means the swap is a
 * fill, not a jump.
 */
export function CoachingResultSkeleton({
  compare = true,
  className,
}: {
  compare?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("@container/coaching space-y-4", className)}>
      <section>
        <Skeleton className="h-3.5 w-32" />
        <div className="mt-2 max-w-prose space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      </section>

      {compare ? (
        <section className={COMPARE_GRID}>
          <div className={PANEL_ORIGINAL}>
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="mt-2 h-28" />
          </div>
          <div className={PANEL_REWRITE}>
            <Skeleton className="h-3.5 w-36" />
            <Skeleton className="mt-2 h-28" />
          </div>
        </section>
      ) : (
        <section>
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="mt-2 h-24 max-w-prose" />
        </section>
      )}

      <section>
        <Skeleton className="h-3.5 w-28" />
        <Skeleton className="mt-2 h-24 max-w-prose" />
      </section>
    </div>
  );
}
