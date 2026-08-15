"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { JobDescriptionSummary } from "@/hooks/use-job-descriptions";

/**
 * Read the stored job description.
 *
 * Until this existed the text was unreadable everywhere after it was saved —
 * not in the wizard, not in the library, not in the edit dialog. Two problems
 * followed from that. With several postings for one role there was no way to
 * tell which one a session was about to use; and the tidy-up step could remove
 * whatever it liked, because nothing afterwards could show you what survived.
 *
 * Costs no request: `rawText` is already on `JobDescriptionSummary` and already
 * in both surfaces' `items`.
 *
 * The character count is in the header on purpose rather than as decoration. It
 * is the one number that makes a tidy-up or a text edit legible after the fact
 * — the difference between "this looks about right" and "this is a third of
 * what I pasted".
 */
export function JobDescriptionPreviewDialog({
  item,
  onOpenChange,
}: {
  /** The JD being previewed, or null when closed. */
  item: JobDescriptionSummary | null;
  onOpenChange: (open: boolean) => void;
}) {
  const subtitle = item
    ? [
        item.company,
        item.roleTitle,
        `${item.rawText.length.toLocaleString()} characters`,
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
          <DialogTitle className="pr-6">
            {item?.title ?? "Job description"}
          </DialogTitle>
          <DialogDescription>{subtitle}</DialogDescription>
        </DialogHeader>

        {/* The scroll sits on the body rather than on DialogContent so the
            header stays put while a long posting scrolls under it. */}
        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {item?.rawText}
          </p>
        </div>

        {item?.sourceUrl && (
          <a
            href={item.sourceUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="truncate text-xs font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700"
          >
            {item.sourceUrl}
          </a>
        )}
      </DialogContent>
    </Dialog>
  );
}
