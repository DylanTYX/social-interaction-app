"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PdfDropZone } from "@/components/ui/pdf-drop-zone";
import { Textarea } from "@/components/ui/textarea";
import { TidyJobDescription } from "@/components/setup/tidy-job-description";
import type { JobDescriptionSummary } from "@/hooks/use-job-descriptions";

/** Enough text to be worth a confirmation before throwing it away. */
export const DRAFT_WORTH_KEEPING_CHARS = 40;

export interface JobDescriptionDraft {
  method: "paste" | "upload";
  company: string;
  roleTitle: string;
  sourceUrl: string;
  text: string;
}

export function emptyDraft(): JobDescriptionDraft {
  return {
    method: "paste",
    company: "",
    roleTitle: "",
    sourceUrl: "",
    text: "",
  };
}

/**
 * Everything needed to create a job description, in one place.
 *
 * The library page and the setup wizard both need this and used to carry
 * near-copies of it — the same fields, the same paste box, the same drop zone,
 * with drifting labels and palettes. Worse, the wizard's copy lived *inside*
 * the picker, which made the card a chooser and an editor at once and was the
 * root of a run of bugs: an "Add" button that did nothing, a stale company
 * leaking onto the next document created, and a draft silently wiped by
 * selecting something else.
 *
 * The draft is lifted to the caller deliberately. Both hosts need to know
 * whether there is unsaved work in it — the library page to clear it after a
 * save, the wizard's dialog to warn before discarding it — and state hidden in
 * here would leave them guessing.
 */
export function JobDescriptionAddForm({
  draft,
  onDraftChange,
  onSubmitText,
  onSubmitFile,
  busy,
  error,
  submitLabel = "Save job description",
}: {
  draft: JobDescriptionDraft;
  onDraftChange: (next: JobDescriptionDraft) => void;
  onSubmitText: () => void;
  onSubmitFile: (file: File) => void;
  busy: boolean;
  error?: string | null;
  submitLabel?: string;
}) {
  const patch = (part: Partial<JobDescriptionDraft>) =>
    onDraftChange({ ...draft, ...part });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <ChoiceChip
          selected={draft.method === "paste"}
          onClick={() => patch({ method: "paste" })}
        >
          Paste text
        </ChoiceChip>
        <ChoiceChip
          selected={draft.method === "upload"}
          onClick={() => patch({ method: "upload" })}
        >
          Upload PDF
        </ChoiceChip>
      </div>

      {/* Company first: it is the field that makes a library of more than a few
          postings navigable, and the one the title falls back to. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company (optional)" htmlFor="jd-company">
          <Input
            id="jd-company"
            placeholder="e.g. Monzo"
            value={draft.company}
            onChange={(event) => patch({ company: event.target.value })}
          />
        </Field>
        <Field label="Applied role title (optional)" htmlFor="jd-role-title">
          <Input
            id="jd-role-title"
            placeholder="e.g. Senior Product Manager"
            value={draft.roleTitle}
            onChange={(event) => patch({ roleTitle: event.target.value })}
          />
        </Field>
      </div>

      <Field label="Link to the posting (optional)" htmlFor="jd-source-url">
        <Input
          id="jd-source-url"
          type="url"
          inputMode="url"
          placeholder="https://..."
          value={draft.sourceUrl}
          onChange={(event) => patch({ sourceUrl: event.target.value })}
        />
      </Field>

      {draft.method === "paste" ? (
        <div className="space-y-4">
          <Field
            label="Job description text"
            htmlFor="jd-paste-text"
            aside={
              <span className="text-xs tabular-nums text-muted-foreground">
                {draft.text.trim().length} chars
              </span>
            }
          >
            <Textarea
              id="jd-paste-text"
              placeholder="Paste responsibilities, requirements, and context..."
              value={draft.text}
              onChange={(event) => patch({ text: event.target.value })}
              className="min-h-40 resize-y"
            />
          </Field>

          <TidyJobDescription
            rawText={draft.text}
            onApply={(result) =>
              patch({
                text: result.cleanedText,
                // Filled in only, never overwritten: what the user typed beats
                // what was inferred from the page.
                company: draft.company || (result.company ?? ""),
                roleTitle: draft.roleTitle || (result.roleTitle ?? ""),
              })
            }
          />

          <Button type="button" onClick={onSubmitText} disabled={busy}>
            {busy ? "Saving..." : submitLabel}
          </Button>
        </div>
      ) : (
        <PdfDropZone
          onSelect={onSubmitFile}
          busy={busy}
          label="Upload a PDF job description"
          hint="Text is extracted and embedded automatically. Image-only PDFs are not supported in this version."
        />
      )}

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The save half, shared so both hosts create job descriptions identically.
 *
 * Returns the created row, or null — the hook has already surfaced the error.
 */
export function useJobDescriptionCreator({
  uploadText,
  uploadPdf,
}: {
  uploadText: (input: {
    rawText: string;
    roleTitle?: string | null;
    company?: string | null;
    sourceUrl?: string | null;
  }) => Promise<JobDescriptionSummary | null>;
  uploadPdf: (input: {
    file: File;
    roleTitle?: string | null;
    company?: string | null;
    sourceUrl?: string | null;
  }) => Promise<JobDescriptionSummary | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const metadata = (draft: JobDescriptionDraft) => ({
    roleTitle: draft.roleTitle.trim() || null,
    company: draft.company.trim() || null,
    sourceUrl: draft.sourceUrl.trim() || null,
  });

  const submitText = async (draft: JobDescriptionDraft) => {
    setError(null);
    if (draft.text.trim().length < 80) {
      setError("Paste at least 80 characters of job description text.");
      return null;
    }
    setBusy(true);
    const created = await uploadText({
      rawText: draft.text,
      ...metadata(draft),
    });
    setBusy(false);
    return created;
  };

  const submitFile = async (draft: JobDescriptionDraft, file: File) => {
    setError(null);
    setBusy(true);
    const created = await uploadPdf({ file, ...metadata(draft) });
    setBusy(false);
    return created;
  };

  return { busy, error, setError, submitText, submitFile };
}
