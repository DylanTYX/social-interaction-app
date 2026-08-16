"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MIN_RESUME_CHARS } from "@/lib/api/input-limits";
import type { ResumeSummary } from "@/hooks/use-resumes";

export interface ResumePatch {
  title: string;
  variant: string | null;
  notes: string | null;
  /** Sent only when actually changed — this is the edit the server can refuse. */
  rawText?: string;
}

/**
 * Edit a saved resume.
 *
 * Until this existed there was no update path at all, which mattered most for
 * the title: it is derived rather than entered, from the first line of the
 * file. A resume whose first line is a phone number, or just the word
 * "Resume", was labelled that in the library permanently.
 *
 * The text is editable, with one rule the server enforces and this explains:
 * not while an interview using it is still in progress. The title, variant and
 * notes never reach a prompt, so changing those mid-session is harmless. The
 * text is read live on every turn, so replacing it under a running interview
 * means the first half probes one career history and the second half another,
 * both landing on the same report.
 */
export function ResumeEditDialog({
  item,
  onOpenChange,
  onSave,
}: {
  /** The resume being edited, or null when the dialog is closed. */
  item: ResumeSummary | null;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: ResumePatch) => Promise<boolean>;
}) {
  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {/* Keyed on the id so opening a different resume remounts the form and its
            fields seed from the new props. The alternative — one long-lived
            form copying props into state from an effect — runs a render with
            the previous resume's values still in the inputs, and needs a second
            pass to correct itself. */}
        {item && (
          <EditForm
            key={item.id}
            item={item}
            onOpenChange={onOpenChange}
            onSave={onSave}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  item,
  onOpenChange,
  onSave,
}: {
  item: ResumeSummary;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: ResumePatch) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(item.title);
  const [variant, setVariant] = useState(item.variant ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [rawText, setRawText] = useState(item.rawText);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textChanged = rawText.trim() !== item.rawText.trim();

  const handleSave = async () => {
    if (!title.trim()) {
      // Enforced here as well as in the route, because a title is what every
      // list and picker renders, and the column is `not null`.
      setError("Give it a title so you can find it later.");
      return;
    }

    if (textChanged && rawText.trim().length < MIN_RESUME_CHARS) {
      setError(`The resume needs at least ${MIN_RESUME_CHARS} characters.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Empty string clears the field; the route distinguishes that from an
      // absent key, which leaves it alone. `rawText` is omitted entirely when
      // unchanged, so an ordinary rename is never refused.
      const ok = await onSave(item.id, {
        title: title.trim(),
        variant: variant.trim() || null,
        notes: notes.trim() || null,
        ...(textChanged ? { rawText: rawText.trim() } : {}),
      });
      if (!ok) {
        setError("Could not save those changes. Try again.");
        return;
      }
      onOpenChange(false);
    } catch (err) {
      // The refusal arrives here — it names how many interviews are in the way,
      // which is the actionable part and belongs beside the field, not in a
      // banner over the list behind this dialog.
      setError(
        err instanceof Error
          ? err.message
          : "Could not save those changes. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader className="text-left">
        <DialogTitle>Edit resume</DialogTitle>
        <DialogDescription>
          Editing the text changes what the interviewer reads, which is refused
          while an interview using it is still in progress.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-resume-title">Title</Label>
          <Input
            id="edit-resume-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Jane Doe · 2026"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-resume-variant">Version</Label>
          <Input
            id="edit-resume-variant"
            value={variant}
            onChange={(event) => setVariant(event.target.value)}
            placeholder="e.g. Backend version"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-resume-notes">Notes</Label>
          <Textarea
            id="edit-resume-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Anything worth remembering — which roles you send this one to, what to emphasise."
            className="min-h-24 resize-y"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="edit-resume-text">Resume text</Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {rawText.trim().length.toLocaleString()} chars
              {/* Named as soon as it differs, because the consequence is not
                  obvious: this is the edit the server can refuse. */}
              {textChanged && " · changes what the interviewer reads"}
            </span>
          </div>
          <Textarea
            id="edit-resume-text"
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            className="min-h-48 resize-y font-mono text-xs leading-relaxed"
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </DialogFooter>
    </>
  );
}
