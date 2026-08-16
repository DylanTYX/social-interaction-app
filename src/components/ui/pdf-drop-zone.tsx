"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Choose a PDF to upload.
 *
 * The hidden-input-behind-a-button dance was byte-identical in four places —
 * both job-description surfaces and both resume ones — including the same
 * `event.target.value = ""` reset, which is load-bearing and easy to drop when
 * copying: without it, picking the same file twice in a row fires no `change`
 * event at all, so a failed upload could not be retried with the same file.
 *
 * The surrounding panel had drifted between copies (different palettes,
 * slightly different copy) with no reason behind the differences, which is the
 * usual result of four copies rather than one component.
 *
 * It is deliberately **not** tinted by the document's accent any more. It used
 * to take an `accent` prop, so the job-description uploader rendered green and
 * the resume uploader rendered teal — two panels running the same component, doing
 * the same job, in the same wizard, that looked like different features. The
 * accent still identifies the document, but it does that once, in the page
 * header icon; below the header the interaction language is the primary blue
 * everywhere. Colour says what a thing *is*, blue says what you can *do*.
 *
 * Despite the name this is not a drop target — nothing in the app has ever
 * accepted a dragged file. The dashed border says otherwise, which is worth
 * fixing, but changing it here would change it in four places at once and that
 * is a separate decision.
 */
export function PdfDropZone({
  onSelect,
  busy = false,
  busyLabel = "Uploading...",
  label,
  hint,
  className,
}: {
  onSelect: (file: File) => void;
  busy?: boolean;
  busyLabel?: string;
  label: string;
  hint?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-primary-border bg-primary-subtle/40 p-4",
        className,
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Cleared before the handler runs so re-picking the same file still
          // fires `change`; otherwise a retry after a failure silently does
          // nothing.
          event.target.value = "";
          if (file) onSelect(file);
        }}
      />
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-muted text-primary">
          <Upload className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? busyLabel : "Choose PDF"}
        </Button>
      </div>
    </div>
  );
}
