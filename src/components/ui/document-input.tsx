"use client";

import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * One surface for getting a document in: paste it, drop a PDF on it, or pick
 * a PDF with the button in its footer.
 *
 * This replaces a "Paste text / Upload PDF" toggle that made the user decide
 * how they would add a document before they could add it, then showed one of
 * two unrelated panels. Nothing about the two methods was exclusive: both end
 * in the same saved document. So they share a box. The text area is the box,
 * the footer holds the upload button beside the save button, and the whole
 * thing is a drop target, which the old dashed "drop zone" only pretended to be.
 *
 * The file input is cleared before the handler runs so picking the same file
 * twice fires `change` again; otherwise a retry after a failed upload silently
 * does nothing.
 */
export function DocumentInput({
  id,
  value,
  onChange,
  placeholder,
  onFile,
  onReject,
  busy = false,
  uploadLabel = "Upload PDF",
  busyLabel = "Uploading…",
  footer,
  actions,
  className,
  ...describedBy
}: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  onFile: (file: File) => void;
  /** Called with a message when a dropped file is not a PDF. */
  onReject?: (message: string) => void;
  busy?: boolean;
  uploadLabel?: string;
  busyLabel?: string;
  /** Left side of the footer: a hint, a count, a secondary control. */
  footer?: ReactNode;
  /** Right side of the footer, after the upload button: the save button. */
  actions?: ReactNode;
  className?: string;
  "aria-describedby"?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Counted rather than toggled: dragging over the footer fires leave/enter
  // on the child, and a boolean would flicker the overlay off between them.
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  const accept = (file: File | undefined) => {
    if (!file) return;
    const isPdf =
      file.type === "application/pdf" ||
      file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      onReject?.("Only PDF files can be uploaded. Paste the text instead.");
      return;
    }
    onFile(file);
  };

  const hasFiles = (event: DragEvent) =>
    Array.from(event.dataTransfer?.types ?? []).includes("Files");

  return (
    <div
      onDragEnter={(event) => {
        if (!hasFiles(event) || busy) return;
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (!hasFiles(event) || busy) return;
        event.preventDefault();
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        if (!hasFiles(event) || busy) return;
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        accept(event.dataTransfer.files?.[0]);
      }}
      className={cn(
        "relative rounded-xl border bg-white transition-[border-color,box-shadow] duration-150",
        "focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary-muted",
        dragging
          ? "border-primary ring-[3px] ring-primary-muted"
          : "border-slate-200",
        className,
      )}
    >
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={busy}
        aria-describedby={describedBy["aria-describedby"]}
        className="block min-h-44 w-full resize-y rounded-t-xl bg-transparent px-4 py-3 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-50"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {footer}
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              accept(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            <Upload />
            {busy ? busyLabel : uploadLabel}
          </Button>
          {actions}
        </div>
      </div>

      {dragging && (
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-primary-subtle/90 text-sm font-medium text-primary"
          aria-hidden
        >
          Drop the PDF to upload it
        </div>
      )}
    </div>
  );
}
