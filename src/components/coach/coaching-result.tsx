import { ChevronRight, ListChecks, Sparkles, Wand2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { CONTENT_ENTER } from "@/lib/motion";
import { Skeleton } from "@/components/ui/skeleton";
import type { SuggestedAnswerResult } from "@/lib/coach-contract";

/**
 * The rendered output of `/api/coach/suggested-answer`, shared by the drills
 * page and the report transcript's `TurnCoaching` disclosure.
 *
 * Three results, three different weights — not a grid of equal boxes, which is
 * what this was and which gave the eye nowhere to land:
 *
 *   1. The diff. One card, split down the middle: what you wrote on the left in
 *      grey, the same answer tightened on the right in amber. A single bordered
 *      object rather than two, because before/after is one idea.
 *   2. The critique. No border at all — a numbered list under a quiet heading.
 *      It is short, and boxing four one-line tips made them look like four
 *      separate documents.
 *   3. The exemplar, collapsed behind a disclosure. See `Exemplar`.
 *
 * A native `<details>` for (3) rather than `useState`: no client boundary, no
 * state to reset when the next question loads, and the keyboard and
 * screen-reader behaviour is the platform's rather than ours to re-implement.
 */

const BODY = "whitespace-pre-line text-sm leading-relaxed";
const LABEL =
  "flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide";

/**
 * Two columns once the *container* is wide, not the viewport.
 *
 * In the report this renders inside `max-w-2xl` — a ~640px box on a viewport
 * wide enough to satisfy any `md:` query, so a viewport breakpoint would split
 * it into two 300px columns. `@3xl` rather than `@2xl` keeps every two-column
 * instance at ≥376px, since ~350px is too narrow to read two passages side by
 * side.
 *
 * Always on a child of the container, never on the container element itself: an
 * element is not its own container query context, so `@3xl/coaching:` on the
 * `@container/coaching` div would silently never match.
 */
const SPLIT = "grid @3xl/coaching:grid-cols-2";

/**
 * The before/after card.
 *
 * The two halves share one border and differ by fill, so they read as one
 * object with a seam rather than as two cards that happen to be adjacent. The
 * seam flips from a top border to a left border at `@3xl`, which is the whole
 * reason the halves are not `PANEL`s: two rounded boxes cannot show a seam.
 */
function Diff({
  originalAnswer,
  rewrite,
}: {
  originalAnswer?: string;
  rewrite: string;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className={SPLIT}>
        {originalAnswer && (
          <div className="p-4">
            <h3 className={cn(LABEL, "text-slate-400")}>Your answer</h3>
            {/* Lighter than the rewrite beside it on purpose. You wrote this
                and you are not here to re-read it — it is the reference the
                other half is measured against. */}
            <p className={cn(BODY, "mt-2 text-slate-500")}>{originalAnswer}</p>
          </div>
        )}
        <div
          className={cn(
            "bg-warning-subtle p-4",
            originalAnswer &&
              "border-t border-warning-border/60 @3xl/coaching:border-l @3xl/coaching:border-t-0",
          )}
        >
          <h3 className={cn(LABEL, "text-warning-emphasis")}>
            <Wand2 className="h-3.5 w-3.5" />
            Your answer, tightened
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Your own facts, restructured. You could say this tomorrow.
          </p>
          <p className={cn(BODY, "mt-2 text-slate-700")}>{rewrite}</p>
        </div>
      </div>
    </div>
  );
}

/**
 * The suggested answer, collapsed.
 *
 * Open by default it was the third long passage in a row and read as more of
 * the same. It is also the one output you cannot use: the prompt binds every
 * specific in the rewrite to a fact the candidate gave, and explicitly licenses
 * this one to invent them. So it is not the answer — it is the ceiling, and it
 * earns its place only when the rewrite has clearly hit one, which is exactly
 * the moment a candidate goes looking for it.
 */
function Exemplar({ text }: { text: string }) {
  return (
    <details className="group/exemplar rounded-xl border border-success-border bg-success-subtle/60">
      <summary
        className={cn(
          LABEL,
          "cursor-pointer list-none rounded-xl px-4 py-3 text-success-emphasis",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        See a full example answer
        <ChevronRight className="ml-auto h-4 w-4 transition-transform group-open/exemplar:rotate-90 motion-reduce:transition-none" />
      </summary>
      <div className="border-t border-success-border/60 px-4 pb-4 pt-3">
        {/* Says the one thing a candidate has to know before reading it: the
            details are made up, so repeating them in an interview would be
            lying. Every attempt to say that in fewer words ("a yardstick, not
            a script") said it to someone who already knew it. */}
        <p className="text-xs text-slate-500">
          An invented example, so the details are not yours to use. Copy how it
          is built, not what it says.
        </p>
        <p className={cn(BODY, "mt-2 text-slate-700")}>{text}</p>
      </div>
    </details>
  );
}

export function CoachingResult({
  result,
  originalAnswer,
  className,
}: {
  result: SuggestedAnswerResult;
  /**
   * The answer that produced `result`, rendered beside the rewrite as a
   * before/after pair.
   *
   * Pass it only where the original is not already on screen. The report
   * transcript shows the answer in a bubble directly above this, so it omits it
   * and the rewrite fills the card alone.
   *
   * Optional rather than paired with a `compare` boolean so that "compare on,
   * nothing to compare" cannot be expressed.
   */
  originalAnswer?: string;
  className?: string;
}) {
  const original = originalAnswer?.trim() ? originalAnswer : undefined;

  return (
    <div className="@container/coaching">
      <div className={cn("space-y-5", CONTENT_ENTER, className)}>
        {result.rewrite && (
          <Diff originalAnswer={original} rewrite={result.rewrite} />
        )}

        {result.tips.length > 0 && (
          <section>
            <h3 className={cn(LABEL, "text-slate-500")}>
              <ListChecks className="h-3.5 w-3.5" />
              What to improve
            </h3>
            {/* Unboxed, and two columns where there is room. Four short tips in
                one narrow stack looked like an error log. */}
            <ol className={cn(SPLIT, "mt-3 gap-x-8 gap-y-2.5")}>
              {result.tips.map((tip, index) => (
                <li
                  key={index}
                  className="flex gap-2.5 text-sm leading-relaxed text-slate-700"
                >
                  <span
                    aria-hidden
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning-muted text-[11px] font-semibold text-warning-emphasis"
                  >
                    {index + 1}
                  </span>
                  {tip}
                </li>
              ))}
            </ol>
          </section>
        )}

        {result.suggestedAnswer && <Exemplar text={result.suggestedAnswer} />}
      </div>
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
    <div className="@container/coaching">
      <div className={cn("space-y-5", className)}>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className={SPLIT}>
            {compare && (
              <div className="p-4">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="mt-3 h-28" />
              </div>
            )}
            <div
              className={cn(
                "bg-warning-subtle p-4",
                compare &&
                  "border-t border-warning-border/60 @3xl/coaching:border-l @3xl/coaching:border-t-0",
              )}
            >
              <Skeleton className="h-3.5 w-36" />
              {/* The hint line under the label. A skeleton a row shorter than
                  what replaces it reflows the page at the moment the user
                  starts reading. */}
              <Skeleton className="mt-1.5 h-3 w-52" />
              <Skeleton className="mt-3 h-28" />
            </div>
          </div>
        </div>

        <section>
          <Skeleton className="h-3.5 w-32" />
          <div className={cn(SPLIT, "mt-3 gap-x-8 gap-y-2.5")}>
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
            <Skeleton className="h-5" />
          </div>
        </section>

        {/* The collapsed disclosure, at its collapsed height. */}
        <div className="rounded-xl border border-success-border bg-success-subtle/60 px-4 py-3">
          <Skeleton className="h-3.5 w-44" />
        </div>
      </div>
    </div>
  );
}
