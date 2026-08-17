import { BadgeCheck, ListChecks, MessageSquare, Wand2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { CONTENT_ENTER } from "@/lib/motion";
import { Skeleton } from "@/components/ui/skeleton";
import type { SuggestedAnswerResult } from "@/lib/coach-contract";

/**
 * The rendered output of `/api/coach/suggested-answer`, shared by the drills page
 * and the report transcript's `TurnCoaching` disclosure.
 *
 * Four things come back and they are not four of the same thing, so each one
 * is a panel with its own tone rather than a run of labelled paragraphs:
 *
 *   your answer  →  slate, subordinate: reference material for the panel beside it
 *   tightened    →  amber, the coaching accent: your words, fixed
 *   to improve   →  slate ground, amber label: the critique of the left column
 *   suggested    →  emerald: the bar to clear, written from scratch
 *
 * Laid out as a 2x2 the columns mean something — left is yours, right is the
 * coach's — and, more prosaically, nothing is left as a half-width paragraph
 * with dead space beside it, which is what a stack of `max-w-prose` blocks in
 * a full-width dashboard card looked like.
 *
 * One palette rather than a `tone` prop for the whole block: both call sites
 * now render this on white, so the darker label rungs clear AA everywhere.
 */

const PANEL = "rounded-xl border p-4";
const BODY = "mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700";
const LABEL =
  "flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide";

const TONES = {
  /** What you wrote. Deliberately the quietest panel on screen. */
  original: {
    panel: "border-slate-200 bg-slate-50/70",
    label: "text-slate-500",
  },
  /** The critique. Neutral ground so it does not compete with the rewrite. */
  tips: {
    panel: "border-slate-200 bg-slate-50/70",
    label: "text-warning-emphasis",
  },
  rewrite: {
    panel: "border-warning-border bg-warning-subtle",
    label: "text-warning-emphasis",
  },
  suggested: {
    panel: "border-success-border bg-success-subtle",
    label: "text-success-emphasis",
  },
} as const;

/**
 * Two columns once the *container* is wide, not the viewport.
 *
 * In the report this renders inside `max-w-2xl` — a ~640px box on a viewport
 * wide enough to satisfy any `md:` query, so a viewport breakpoint would split
 * it into two 300px columns. `@3xl` rather than `@2xl` keeps every two-column
 * instance at ≥376px, since ~350px is too narrow to read two passages side by
 * side.
 *
 * Lives on a child of the container, never on the container element itself: an
 * element is not its own container query context, so `@3xl/coaching:` on the
 * `@container/coaching` div would silently never match.
 */
const GRID = "grid gap-4 @3xl/coaching:grid-cols-2";

/**
 * `h3` for the reason `CardTitle` already argues: these pages had almost no
 * headings, so a screen-reader user jumping by heading got the page title and
 * nothing else. Both call sites render this under an `h2`, so the level skips
 * none.
 */
function Panel({
  tone,
  icon,
  title,
  hint,
  className,
  children,
}: {
  tone: keyof typeof TONES;
  icon: React.ReactNode;
  title: string;
  /**
   * What this panel is *for*, in one line.
   *
   * The rewrite and the suggested answer are two passages of similar-looking
   * prose answering the same question, and without this they read as the same
   * thing printed twice. They are not: the prompt binds every specific in the
   * rewrite to a fact the candidate actually gave, and explicitly licenses the
   * suggested answer to invent them. One is something you could say tomorrow;
   * the other is a yardstick you would be lying to repeat. That distinction is
   * the whole reason both are generated, so it belongs on screen rather than
   * in the prompt file.
   */
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(PANEL, TONES[tone].panel, className)}>
      <h3 className={cn(LABEL, TONES[tone].label)}>
        {icon}
        {title}
      </h3>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {children}
    </section>
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
   * and the rewrite renders alone — a pair there would duplicate the bubble.
   *
   * Optional rather than paired with a `compare` boolean so that "compare on,
   * nothing to compare" cannot be expressed.
   */
  originalAnswer?: string;
  className?: string;
}) {
  const compare = Boolean(originalAnswer?.trim());

  /**
   * Placed after the before/after pair when there is one, so the two halves of
   * the diff stay adjacent and the critique reads as commentary on them; first
   * and full-width when there is not, because then it is the only thing that
   * would otherwise share a row with a passage of prose.
   */
  const tips = result.tips.length > 0 && (
    <Panel
      tone="tips"
      icon={<ListChecks className="h-3.5 w-3.5" />}
      title="What to improve"
      className={compare ? undefined : "@3xl/coaching:col-span-2"}
    >
      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed text-slate-700">
        {result.tips.map((tip, index) => (
          <li key={index}>{tip}</li>
        ))}
      </ul>
    </Panel>
  );

  return (
    <div className="@container/coaching">
      <div className={cn(GRID, CONTENT_ENTER, className)}>
        {!compare && tips}

        {/* Original first, so before → after reads correctly across at `@3xl`
            and down below it. Grid stretch is wanted: both panels hold the same
            text, so their heights track. */}
        {compare && (
          <Panel
            tone="original"
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            title="Your answer"
          >
            <p className={BODY}>{originalAnswer}</p>
          </Panel>
        )}

        {result.rewrite && (
          <Panel
            tone="rewrite"
            icon={<Wand2 className="h-3.5 w-3.5" />}
            title="Your answer, tightened"
            hint="Your own facts, restructured. You could say this tomorrow."
          >
            <p className={BODY}>{result.rewrite}</p>
          </Panel>
        )}

        {compare && tips}

        {result.suggestedAnswer && (
          <Panel
            tone="suggested"
            icon={<BadgeCheck className="h-3.5 w-3.5" />}
            title="Suggested answer"
            hint="Written from scratch, with invented specifics. A yardstick, not a script."
          >
            <p className={BODY}>{result.suggestedAnswer}</p>
          </Panel>
        )}
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
  const tips = (
    <div
      className={cn(
        PANEL,
        TONES.tips.panel,
        compare ? undefined : "@3xl/coaching:col-span-2",
      )}
    >
      <Skeleton className="h-3.5 w-32" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-11/12" />
      </div>
    </div>
  );

  return (
    <div className="@container/coaching">
      <div className={cn(GRID, className)}>
        {!compare && tips}

        {compare && (
          <div className={cn(PANEL, TONES.original.panel)}>
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="mt-3 h-28" />
          </div>
        )}

        {/* Two bars in the head, not one: these are the panels that carry a
            `hint` line, and a skeleton a row shorter than what replaces it
            reflows the page at the exact moment the user starts reading. */}
        <div className={cn(PANEL, TONES.rewrite.panel)}>
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="mt-1.5 h-3 w-52" />
          <Skeleton className="mt-3 h-28" />
        </div>

        {compare && tips}

        <div className={cn(PANEL, TONES.suggested.panel)}>
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="mt-1.5 h-3 w-56" />
          <Skeleton className="mt-3 h-28" />
        </div>
      </div>
    </div>
  );
}
