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
import type { JobDescriptionSummary } from "@/hooks/use-job-descriptions";

export interface JobDescriptionPatch {
  title: string;
  roleTitle: string | null;
  company: string | null;
  sourceUrl: string | null;
  notes: string | null;
  /** Sent only when actually changed; re-embedding is not free. */
  rawText?: string;
}

/**
 * Edit a saved job description.
 *
 * Until this existed there was no update path at all, which mattered most for
 * the title — it is derived, not entered, falling back to the first line of the
 * pasted text between 4 and 80 characters. Paste from a careers page and the
 * library shows "About the role", permanently.
 *
 * The text is editable, with one rule the server enforces and this explains:
 * not while an interview using it is still in progress. Metadata is
 * snapshotted into the session at launch, so changing it later cannot disturb a
 * running interview; the chunks are read live on every turn, so re-embedding
 * them mid-session would ground the first half of an interview on one document
 * and the second half on another, both landing on the same report.
 */
export function JobDescriptionEditDialog({
  item,
  onOpenChange,
  onSave,
}: {
  /** The JD being edited, or null when the dialog is closed. */
  item: JobDescriptionSummary | null;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: JobDescriptionPatch) => Promise<boolean>;
}) {
  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        {/* Keyed on the id so opening a different JD remounts the form and its
            fields seed from the new props. The alternative — one long-lived
            form copying props into state from an effect — runs a render with
            the previous JD's values still in the inputs, and needs a second
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
  item: JobDescriptionSummary;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, patch: JobDescriptionPatch) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(item.title);
  const [roleTitle, setRoleTitle] = useState(item.roleTitle ?? "");
  const [company, setCompany] = useState(item.company ?? "");
  const [sourceUrl, setSourceUrl] = useState(item.sourceUrl ?? "");
  const [notes, setNotes] = useState(item.notes ?? "");
  const [rawText, setRawText] = useState(item.rawText);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textChanged = rawText.trim() !== item.rawText.trim();

  const handleSave = async () => {
    if (!title.trim()) {
      // Enforced here as well as in the route, because a title is what every
      // list, picker and chip in the app renders, and the column is `not null`.
      setError("Give it a title so you can find it later.");
      return;
    }

    if (textChanged && rawText.trim().length < 80) {
      setError("The job description needs at least 80 characters.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Empty string clears the field; the route distinguishes that from an
      // absent key, which leaves it alone. `rawText` is omitted entirely when
      // unchanged, so an ordinary metadata edit never triggers a re-embed.
      const ok = await onSave(item.id, {
        title: title.trim(),
        roleTitle: roleTitle.trim() || null,
        company: company.trim() || null,
        sourceUrl: sourceUrl.trim() || null,
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
        <DialogTitle>Edit job description</DialogTitle>
        <DialogDescription>
          Editing the text re-indexes it for retrieval, which is refused while
          an interview using it is still in progress.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="edit-jd-title">Title</Label>
          <Input
            id="edit-jd-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Data Analyst at Monzo"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="edit-jd-company">Company</Label>
            <Input
              id="edit-jd-company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="e.g. Monzo"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-jd-role">Role title</Label>
            <Input
              id="edit-jd-role"
              value={roleTitle}
              onChange={(event) => setRoleTitle(event.target.value)}
              placeholder="e.g. Senior Product Manager"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-jd-url">Link to the posting</Label>
          <Input
            id="edit-jd-url"
            type="url"
            inputMode="url"
            value={sourceUrl}
            onChange={(event) => setSourceUrl(event.target.value)}
            placeholder="https://..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-jd-notes">Notes</Label>
          <Textarea
            id="edit-jd-notes"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Anything worth remembering — referrer, salary band, what to emphasise."
            className="min-h-24 resize-y"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="edit-jd-text">Job description text</Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {rawText.trim().length.toLocaleString()} chars
              {/* Named as soon as it differs, because the consequence is not
                  obvious: this is the edit that costs an embedding run and the
                  one the server can refuse. */}
              {textChanged && " · will be re-indexed"}
            </span>
          </div>
          <Textarea
            id="edit-jd-text"
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
