"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DocumentInput } from "@/components/ui/document-input";
import { Field, fieldHintId } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { describeTruncation } from "@/lib/document-truncation";
import { MIN_RESUME_CHARS } from "@/lib/api/input-limits";
import type { ResumeSummary } from "@/hooks/use-resumes";

/** Enough text to be worth a confirmation before throwing it away. */
export const DRAFT_WORTH_KEEPING_CHARS = 40;

export interface ResumeDraft {
  label: string;
  text: string;
}

export function emptyResumeDraft(): ResumeDraft {
  return { label: "", text: "" };
}

/**
 * Everything needed to add a resume, in one place.
 *
 * The job description's twin, deliberately: the library page and the setup
 * wizard both need this, and near-copies of the same form in two places is what
 * let the two surfaces drift apart in labels, palette and behaviour.
 *
 * Fewer fields than the job description, because a resume has fewer facts about it
 * — no company, no link to a posting. What it does have is a version label, and
 * that one matters more here than it does there: a resume's title is *guessed*
 * from the first line of the file — usually the person's name — so without a
 * label a library of three resumes reads as three variations on the same name
 * and a date. The label is saved as the `variant` (the edit dialog's "version"
 * field), never the title: overwriting the guessed title would make three
 * differently-named entries that all hide *whose* document they are.
 *
 * There is no tidy-up counterpart. That exists to strip navigation and
 * boilerplate off a posting copied from a careers page; a resume is the user's own
 * document and every line of it is content.
 *
 * Paste and upload share one box (`DocumentInput`); there is no method to
 * choose first.
 */
export function ResumeAddForm({
  draft,
  onDraftChange,
  onSubmitText,
  onSubmitFile,
  busy,
  error,
  submitLabel = "Save resume",
}: {
  draft: ResumeDraft;
  onDraftChange: (next: ResumeDraft) => void;
  onSubmitText: () => void;
  onSubmitFile: (file: File) => void;
  busy: boolean;
  error?: string | null;
  submitLabel?: string;
}) {
  const patch = (part: Partial<ResumeDraft>) =>
    onDraftChange({ ...draft, ...part });
  const [rejection, setRejection] = useState<string | null>(null);

  const length = draft.text.trim().length;
  const message = rejection ?? error;

  return (
    <div className="space-y-6">
      {/* Writes `variant`, the field the edit dialog calls Version and the
          library search claims to cover. It used to be sent as `title`, which
          destroyed the guessed name, left the version column empty, and made
          `variant` unreachable from any add surface. */}
      <Field
        label="Version label (optional)"
        htmlFor="resume-label"
        hint="Only you see this — e.g. which version of your resume it is. The name is taken from the document itself."
      >
        <Input
          id="resume-label"
          placeholder="e.g. Backend version"
          value={draft.label}
          onChange={(event) => patch({ label: event.target.value })}
        />
      </Field>

      <Field
        label="Resume"
        htmlFor="resume-text"
        hint="Paste it, or upload it as a PDF. Scanned or image-only PDFs won't work; only PDFs with selectable text can be read."
        aside={
          <span className="text-xs text-slate-500 tabular-nums">
            {length.toLocaleString()} chars
          </span>
        }
      >
        <DocumentInput
          id="resume-text"
          aria-describedby={fieldHintId("resume-text")}
          value={draft.text}
          onChange={(text) => {
            setRejection(null);
            patch({ text });
          }}
          placeholder="Paste your experience, skills, education and projects…"
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
              disabled={busy || length < MIN_RESUME_CHARS}
            >
              {busy ? "Saving…" : submitLabel}
            </Button>
          }
        />
      </Field>

      {message && (
        <p className="text-sm text-destructive" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

/**
 * The save half, shared so both hosts create resumes identically.
 *
 * Returns the created row, or null — the hook has already surfaced the error.
 */
export function useResumeCreator({
  uploadText,
  uploadPdf,
}: {
  uploadText: (input: {
    rawText: string;
    variant?: string | null;
  }) => Promise<ResumeSummary | null>;
  uploadPdf: (input: {
    file: File;
    variant?: string | null;
  }) => Promise<ResumeSummary | null>;
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
  const reportTruncation = (created: ResumeSummary | null) => {
    if (!created?.truncatedFrom) return;
    const notice = describeTruncation({
      kind: "resume",
      kept: created.rawText.length,
      original: created.truncatedFrom,
    });
    if (notice) toast.warning(notice, { duration: 12_000 });
  };

  const submitText = async (draft: ResumeDraft) => {
    setError(null);
    if (draft.text.trim().length < MIN_RESUME_CHARS) {
      setError(`Paste at least ${MIN_RESUME_CHARS} characters of resume text.`);
      return null;
    }
    setBusy(true);
    const created = await uploadText({
      rawText: draft.text,
      // The form's label is the *version*; the title stays server-guessed
      // from the document's first line, as the edit dialog's split intends.
      variant: draft.label.trim() || null,
    });
    setBusy(false);
    reportTruncation(created);
    return created;
  };

  const submitFile = async (draft: ResumeDraft, file: File) => {
    setError(null);
    setBusy(true);
    const created = await uploadPdf({
      file,
      variant: draft.label.trim() || null,
    });
    setBusy(false);
    reportTruncation(created);
    return created;
  };

  return { busy, error, setError, submitText, submitFile };
}
