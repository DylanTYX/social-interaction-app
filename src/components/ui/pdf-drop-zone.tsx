"use client";

import { useRef } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TILE_COLORS, type TileColor } from "@/lib/tile-colors";
import { cn } from "@/lib/utils";

/**
 * The tinted panel each accent produces.
 *
 * A dashed border and a faint wash, keyed to the document's own accent — the
 * treatment the CV page already used and the one worth keeping. The grey
 * version this replaced read as disabled next to it.
 */
const ACCENT_PANEL: Record<TileColor, string> = {
  blue: "border-blue-200 bg-blue-50/40",
  purple: "border-purple-200 bg-purple-50/40",
  indigo: "border-indigo-200 bg-indigo-50/40",
  green: "border-green-200 bg-green-50/40",
  orange: "border-orange-200 bg-orange-50/40",
  pink: "border-pink-200 bg-pink-50/40",
  teal: "border-teal-200 bg-teal-50/40",
};

/**
 * Choose a PDF to upload.
 *
 * The hidden-input-behind-a-button dance was byte-identical in four places —
 * both job-description surfaces and both CV ones — including the same
 * `event.target.value = ""` reset, which is load-bearing and easy to drop when
 * copying: without it, picking the same file twice in a row fires no `change`
 * event at all, so a failed upload could not be retried with the same file.
 *
 * The surrounding panel had drifted between copies (different palettes,
 * slightly different copy) with no reason behind the differences, which is the
 * usual result of four copies rather than one component.
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
  accent,
  className,
}: {
  onSelect: (file: File) => void;
  busy?: boolean;
  busyLabel?: string;
  label: string;
  hint?: string;
  /**
   * The document's accent. Required rather than defaulted, so a new caller has
   * to state which document it belongs to — the drift this component exists to
   * end started with each surface quietly picking its own colour.
   */
  accent: TileColor;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      className={cn(
        "rounded-xl border border-dashed p-4",
        ACCENT_PANEL[accent],
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
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full",
            TILE_COLORS[accent],
          )}
        >
          <Upload className="h-5 w-5" />
        </div>
        <p className="text-sm font-medium text-gray-800">{label}</p>
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
