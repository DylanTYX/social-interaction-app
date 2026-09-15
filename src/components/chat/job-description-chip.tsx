"use client";

import { AlertCircle, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";

/**
 * The "this interview is grounded on a job description" badge in the interview
 * top bar.
 *
 * Extracted because the text and voice screens carried identical copies, and
 * because it needed a state neither of them could express.
 *
 * That state: the JD can be deleted while a session is unfinished. The FK is
 * `on delete set null`, so the session survives, but `launch_meta` keeps the
 * snapshot taken at launch — which still names the JD. The chip read that
 * snapshot, so it went on confidently announcing a document that was no longer
 * reaching the prompt *or* the scoring pass. That is worse than showing
 * nothing: it is a positive claim about grounding that is false.
 *
 * `missing` now renders that honestly. Dropping the chip silently would fix the
 * lie but leave the user with an interviewer that quietly changed behaviour
 * mid-session and no way to find out why.
 */
export function JobDescriptionChip({
  title,
  missing,
}: {
  title: string | null;
  missing: boolean;
}) {
  if (missing) {
    return (
      <Badge
        variant="warning"
        className="hidden h-6 sm:inline-flex"
        title="The job description this interview was set up with has been deleted. The interviewer is no longer drawing on it, and answers from here on are scored without it."
      >
        <AlertCircle />
        <span className="max-w-40 truncate">Job description unavailable</span>
      </Badge>
    );
  }

  if (!title) return null;

  return (
    <Badge
      variant="outline"
      className="hidden h-6 sm:inline-flex"
      title={title}
    >
      <FileText />
      <span className="max-w-40 truncate">{title}</span>
    </Badge>
  );
}
