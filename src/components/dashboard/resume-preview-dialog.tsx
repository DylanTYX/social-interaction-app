"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { describeTruncationBadge } from "@/lib/document-truncation";
import type { ResumeSummary } from "@/hooks/use-resumes";

/**
 * Read the stored CV.
 *
 * The job description's twin, and it answers a question that was unanswerable
 * for longer here: the CV text has never been visible anywhere after upload.
 * That matters most for a PDF, where what was stored is not what the user
 * looked at — extraction reorders columns, drops tables and merges headers, and
 * until now the only way to find out was to run an interview and notice the
 * interviewer asking about something odd.
 *
 * Costs no request: `rawText` is already on `ResumeSummary` and already in both
 * surfaces' `items`.
 *
 * The character count sits in the header rather than as decoration. Against the
 * cap it is the one number that says whether the interviewer is reading the
 * whole document.
 */
export function ResumePreviewDialog({
  item,
  onOpenChange,
}: {
  /** The CV being previewed, or null when closed. */
  item: ResumeSummary | null;
  onOpenChange: (open: boolean) => void;
}) {
  const subtitle = item
    ? [
        item.variant,
        `${item.rawText.length.toLocaleString()} characters`,
        // Long after the upload notice has gone, this is the only thing that
        // says the interviewer is reading a partial document.
        describeTruncationBadge(item.truncatedFrom),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <DialogContent className="max-h-[85vh] sm:max-w-2xl">
        <DialogHeader className="text-left">
          <DialogTitle className="pr-6">{item?.title ?? "CV"}</DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        {/* The scroll sits on the body rather than on DialogContent so the
            header stays put while a long CV scrolls under it. */}
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {item?.rawText}
          </p>
        </div>

        {item?.notes && (
          <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            {item.notes}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
