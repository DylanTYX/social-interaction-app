"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DocumentInput } from "@/components/ui/document-input";
import { Field, fieldHintId } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { TidyJobDescription } from "@/components/setup/tidy-job-description";
import { describeTruncation } from "@/lib/document-truncation";
import type { JobDescriptionSummary } from "@/hooks/use-job-descriptions";

/** Enough text to be worth a confirmation before throwing it away. */
export const DRAFT_WORTH_KEEPING_CHARS = 40;

/** The least a pasted posting can be and still be a posting. */
export const MIN_JOB_DESCRIPTION_CHARS = 80;

export interface JobDescriptionDraft {
  company: string;
  roleTitle: string;
  sourceUrl: string;
  text: string;
}

export function emptyDraft(): JobDescriptionDraft {
  return { company: "", roleTitle: "", sourceUrl: "", text: "" };
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
 *
 * Paste and upload share one box (`DocumentInput`); there is no longer a
 * method to choose first. The draft's `method` field went with the toggle.
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
  const [rejection, setRejection] = useState<string | null>(null);

  const length = draft.text.trim().length;
  const message = rejection ?? error;

  return (
    <div className="space-y-6">
      {/* Company first: it is the field that makes a library of more than a few
          postings navigable, and the one the title falls back to. */}
      <div className="grid gap-6 sm:grid-cols-2">
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
          placeholder="https://…"
          value={draft.sourceUrl}
          onChange={(event) => patch({ sourceUrl: event.target.value })}
        />
      </Field>

      <Field
        label="Job description"
        htmlFor="jd-text"
        hint="Paste the posting, or upload it as a PDF. Scanned or image-only PDFs won't work; only PDFs with selectable text can be read."
        aside={
          <span className="text-xs text-slate-500 tabular-nums">
            {length.toLocaleString()} chars
          </span>
        }
      >
        <DocumentInput
          id="jd-text"
          aria-describedby={fieldHintId("jd-text")}
          value={draft.text}
          onChange={(text) => {
            setRejection(null);
            patch({ text });
          }}
          placeholder="Paste the responsibilities, requirements and context…"
          busy={busy}
          onFile={(file) => {
            setRejection(null);
            onSubmitFile(file);
          }}
          onReject={setRejection}
          footer={<span>Paste text, or drop a PDF here</span>}
          actions={
            <Button
              type="button"
              size="sm"
              onClick={onSubmitText}
              disabled={busy || length < MIN_JOB_DESCRIPTION_CHARS}
            >
              {busy ? "Saving…" : submitLabel}
            </Button>
          }
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

      {message && (
        <p className="text-sm text-destructive" role="alert">
          {message}
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

  /**
   * Says so when the upload was shortened.
   *
   * The save succeeded, so this is a notice rather than an error — but it has
   * to be said at all, because the user believes the whole document went in and
   * the interviewer will only ever see the part that did. `truncatedFrom` also
   * persists on the row, so the library keeps saying it after this disappears.
   */
  const reportTruncation = (created: JobDescriptionSummary | null) => {
    if (!created?.truncatedFrom) return;
    const notice = describeTruncation({
      kind: "jobDescription",
      kept: created.rawText.length,
      original: created.truncatedFrom,
    });
    if (notice) toast.warning(notice, { duration: 12_000 });
  };

  const metadata = (draft: JobDescriptionDraft) => ({
    roleTitle: draft.roleTitle.trim() || null,
    company: draft.company.trim() || null,
    sourceUrl: draft.sourceUrl.trim() || null,
  });

  const submitText = async (draft: JobDescriptionDraft) => {
    setError(null);
    if (draft.text.trim().length < MIN_JOB_DESCRIPTION_CHARS) {
      setError(
        `Paste at least ${MIN_JOB_DESCRIPTION_CHARS} characters of job description text.`,
      );
      return null;
    }
    setBusy(true);
    const created = await uploadText({
      rawText: draft.text,
      ...metadata(draft),
    });
    setBusy(false);
    reportTruncation(created);
    return created;
  };

  const submitFile = async (draft: JobDescriptionDraft, file: File) => {
    setError(null);
    setBusy(true);
    const created = await uploadPdf({ file, ...metadata(draft) });
    setBusy(false);
    reportTruncation(created);
    return created;
  };

  return { busy, error, setError, submitText, submitFile };
}
