import type { ResumeUsage } from "@/hooks/use-resumes";

/**
 * What deleting a resume costs, stated as specifically as we can.
 *
 * Shared by the library page and the setup wizard, which both offer a delete
 * and must not describe it differently — the wizard's used to describe it not
 * at all, removing the row on a single click.
 *
 * The old copy said "The extracted text is removed permanently. Interviews that
 * already used it keep their transcripts." Both halves are true, and together
 * they read as "nothing in flight is harmed" — which is exactly wrong for an
 * interview still in progress. Those sessions survive the delete (the FK is
 * `on delete set null`) but the interviewer loses the candidate's background
 * entirely the moment they resume, so the back half of the session is asked
 * generic questions and scored as though that were the plan.
 *
 * That consequence is worse than the job description's, not milder. A deleted
 * JD costs an interview its grounding in one role; a deleted resume costs it every
 * question that was ever going to be about this particular person.
 *
 * Two beats, matching the session-delete dialog: state what goes, then append
 * the downstream consequence only when it applies. While the count is loading,
 * or if it failed, say the general thing — a wrong number here is worse than no
 * number.
 */
export function describeResumeDelete(
  usage: ResumeUsage | null | undefined,
): string {
  const base =
    "The stored text is removed permanently, so interviews can no longer ask about your background from it. Completed transcripts and their scores are unaffected.";

  if (!usage || usage.inProgress === 0) return base;

  const count =
    usage.inProgress === 1
      ? "1 interview that is still in progress uses"
      : `${usage.inProgress} interviews that are still in progress use`;

  return `${base} ${count} it, and will carry on without it when you resume.`;
}
