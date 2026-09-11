"use client";

import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { MAX_SESSION_TITLE_CHARS } from "@/lib/api/input-limits";
import { patchSessionRequest } from "@/lib/session-actions";
import { cn } from "@/lib/utils";

/**
 * A session title renamed by clicking it.
 *
 * The generated title comes from the interview brief or the round name, so it
 * was often long and said little, and nothing let the candidate change it.
 * Enter or clicking away saves; Escape cancels; clearing the field, or typing
 * the generated title back, returns to the generated title rather than storing
 * a copy of it.
 */
export function EditableTitle({
  sessionId,
  title,
  generatedTitle,
  onRenamed,
  className,
}: {
  sessionId: string;
  /** The candidate's own title, or null. */
  title: string | null;
  generatedTitle: string;
  onRenamed: (title: string | null) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  // Escape unmounts the input, and a focused input that unmounts can still
  // report a blur — which would save the draft that was just cancelled.
  const cancelledRef = useRef(false);

  const shown = title?.trim() || generatedTitle;

  const start = () => {
    cancelledRef.current = false;
    setDraft(shown);
    setEditing(true);
  };

  const save = async () => {
    if (cancelledRef.current || saving) return;
    const next = draft.trim();
    const value = !next || next === generatedTitle ? null : next;
    if ((value ?? "") === (title?.trim() ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const session = await patchSessionRequest(sessionId, { title: value });
      onRenamed(session.title);
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't rename this session.");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <form
        className={cn("space-y-1", className)}
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <input
          autoFocus
          value={draft}
          maxLength={MAX_SESSION_TITLE_CHARS}
          disabled={saving}
          aria-label="Session title"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => void save()}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              cancelledRef.current = true;
              setEditing(false);
            }
          }}
          className="w-full rounded-lg border border-primary-border bg-white px-2 py-1 text-2xl font-semibold text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        />
        <p className="text-xs text-slate-500">
          Enter to save · Esc to cancel · clear it to use the generated title
        </p>
      </form>
    );
  }

  return (
    <h1 className={cn("text-2xl font-semibold text-slate-900", className)}>
      <button
        type="button"
        onClick={start}
        title="Rename this session"
        className="group inline-flex max-w-full items-start gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <span className="break-words">{shown}</span>
        <Pencil
          className="mt-2 h-4 w-4 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 print:hidden"
          aria-hidden
        />
        <span className="sr-only">Rename</span>
      </button>
    </h1>
  );
}
