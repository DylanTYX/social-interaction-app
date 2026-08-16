import { cn } from "@/lib/utils";
import { CONTENT_ENTER } from "@/lib/motion";
import { Skeleton } from "@/components/ui/skeleton";
import type { ModelAnswerResult } from "@/lib/coach-contract";

/**
 * The rendered output of `/api/coach/model-answer`, shared by the drills page
 * and the report transcript's `TurnCoaching` disclosure.
 *
 * One palette rather than a `tone` prop: the report sits on
 * `bg-warning-subtle/60` and drills on white, and only the darker rung clears
 * AA on both.
 */

const LABEL =
  "text-xs font-semibold uppercase tracking-wide text-warning-emphasis";
const BODY = "mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700";

const PANEL_ORIGINAL = "rounded-xl border border-slate-200 bg-slate-50/60 p-4";
const PANEL_REWRITE =
  "rounded-xl border border-warning-border bg-warning-subtle/60 p-4";

/**
 * Two columns once the *container* is wide, not the viewport.
 *
 * In the report this renders inside `max-w-2xl` — a ~640px box on a viewport
 * wide enough to satisfy any `md:` query, so a viewport breakpoint would split
 * it into two 300px columns. `@3xl` rather than `@2xl` keeps every two-column
 * instance at ≥376px, since ~350px is too narrow to read two passages side by
 * side.
 */
const COMPARE_GRID = "grid gap-4 @3xl/coaching:grid-cols-2";

/**
 * `h3` for the reason `CardTitle` already argues: these pages had almost no
 * headings, so a screen-reader user jumping by heading got the page title and
 * nothing else. Both call sites render this under an `h2`, so the level skips
 * none. Visually a no-op.
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
    <div
      className={cn("@container/coaching space-y-4", CONTENT_ENTER, className)}
    >
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
          // Original first, so before → after reads correctly across at
          // `@3xl` and down below it. Grid stretch is wanted: both panels hold
          // the same text, so their heights track.
          <section className={COMPARE_GRID}>
            <div className={PANEL_ORIGINAL}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
 * Kept beside `CoachingResult` so it cannot drift from it. The four generic
 * bars this replaces looked nothing like what arrived, so every swap reflowed
 * the page.
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
