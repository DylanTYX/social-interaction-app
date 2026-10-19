import { PANEL_LABEL } from "@/components/dashboard/page-header";
import { cn } from "@/lib/utils";

/**
 * A coding problem, written down.
 *
 * Shown inside the interviewer's message — even in a voice interview, where the
 * rest of the message is withheld — and pinned above the editor while code is
 * being written, so the statement is in view for the whole answer rather than
 * scrolled away under the follow-ups. See `problem-statement.ts`.
 *
 * Plain text with its line breaks kept, not markdown: the statement is the
 * interviewer's fence body, and its examples ("Input: nums = [2, 7, 11]") read
 * best exactly as written.
 */
export function ProblemCard({
  problem,
  className,
}: {
  problem: string;
  className?: string;
}) {
  return (
    <section
      aria-label="Problem"
      className={cn(
        "rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3",
        className,
      )}
    >
      <h3 className={cn(PANEL_LABEL, "mb-1.5")}>Problem</h3>
      <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-900">
        {problem || "…"}
      </p>
    </section>
  );
}
