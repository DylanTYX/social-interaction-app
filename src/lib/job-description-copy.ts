import type { JobDescriptionUsage } from "@/hooks/use-job-descriptions";

/**
 * What deleting a job description costs, stated as specifically as we can.
 *
 * Shared by the library page and the setup wizard, which both offer a delete
 * and must not describe it differently — the wizard's used to describe it not
 * at all, removing the row on a single click.
 *
 * The old copy ended "Existing transcripts are unaffected." True of the message
 * rows, and it reads as "nothing in flight is harmed" — which is exactly wrong
 * for an interview still in progress. Those sessions survive the delete (the FK
 * is `on delete set null`) but lose their grounding the moment they resume: no
 * job context in the interviewer's prompt, and none in the scoring pass either,
 * so the back half of the session is judged against a different bar than the
 * front half.
 *
 * Two beats, matching the session-delete dialog: state what goes, then append
 * the downstream consequence only when it applies. While the count is loading,
 * or if it failed, say the general thing — a wrong number here is worse than no
 * number.
 */
export function describeJobDescriptionDelete(
  usage: JobDescriptionUsage | null | undefined,
): string {
  const base =
    "This also deletes its embedded chunks, so interviews can no longer retrieve context from it. Completed transcripts and their scores are unaffected.";

  if (!usage || usage.inProgress === 0) return base;

  const count =
    usage.inProgress === 1
      ? "1 interview that is still in progress uses"
      : `${usage.inProgress} interviews that are still in progress use`;

  return `${base} ${count} it, and will carry on without it when you resume.`;
}
