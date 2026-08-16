"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileUser, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dashboard/page-header";
import { DocumentListSkeleton } from "@/components/dashboard/page-skeletons";
import { EmptyStateCard } from "@/components/dashboard/empty-state-card";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { useResumes } from "@/hooks/use-resumes";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ROW_ENTER, ROW_EXIT, staggerDelay } from "@/lib/motion";
import { PdfDropZone } from "@/components/ui/pdf-drop-zone";
import { RESUME_ACCENT } from "@/lib/document-accents";

export default function ResumesPage() {
  const { items, status, error, refresh, uploadText, uploadPdf, remove } =
    useResumes();

  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  // The row being animated out. Set before the request goes out, so the
  // list responds the moment the user confirms rather than after a round trip.
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // `updatedAt` desc, numerically. It was `createdAt` with `localeCompare`,
  // which meant editing an entry never moved it — and personas, the sibling
  // library page, has always sorted by `updatedAt`.
  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
      ),
    [items],
  );

  const handlePasteSubmit = async () => {
    setFormError(null);
    if (pastedText.trim().length < 80) {
      setFormError("Paste at least 80 characters of resume text.");
      return;
    }
    setSubmitting(true);
    const created = await uploadText({
      rawText: pastedText,
      title: title.trim() || null,
    });
    setSubmitting(false);
    if (created) {
      setPastedText("");
      setTitle("");
    }
  };

  const handleUploadFile = async (file: File) => {
    setFormError(null);
    setSubmitting(true);
    const created = await uploadPdf({ file, title: title.trim() || null });
    setSubmitting(false);
    if (created) {
      setTitle("");
    }
  };

  return (
    <div className="p-8 space-y-8 bg-linear-to-br from-gray-50 via-white to-gray-50/50">
      <PageHeader
        eyebrow="Library"
        title="Resumes"
        description="Upload or paste your resume so the interviewer can ask targeted questions about your real experience and pressure-test the claims on it."
        icon={<FileUser className="h-6 w-6" />}
        iconColor={RESUME_ACCENT}
        actions={
          <Button asChild>
            <Link href="/simulate/setup">
              <Sparkles className="mr-2 h-4 w-4" />
              Start an interview
            </Link>
          </Button>
        }
      />

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileUser className="h-4 w-4 text-teal-600" />
            Add a resume
          </CardTitle>
          <CardDescription>
            Stored as plain text and sent to the interviewer so questions can
            reference your background. The text is processed by OpenAI to
            generate questions and feedback, so don&apos;t include anything you
            wouldn&apos;t want sent to a third party.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* One accent per document, declared in `document-accents.ts`. This
              page used to run a teal header over a purple body, so it did not
              match its own heading, let alone the job-description page. */}
          <div className="flex flex-wrap gap-2">
            <ChoiceChip
              selected={mode === "paste"}
              onClick={() => setMode("paste")}
            >
              Paste text
            </ChoiceChip>
            <ChoiceChip
              selected={mode === "upload"}
              onClick={() => setMode("upload")}
            >
              Upload PDF
            </ChoiceChip>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resume-title">Label (optional)</Label>
            <Input
              id="resume-title"
              placeholder="e.g. Jane Doe — 2026"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          {mode === "paste" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="paste-text">Resume text</Label>
                <span className="text-xs text-gray-500">
                  {pastedText.trim().length} chars
                </span>
              </div>
              <Textarea
                id="paste-text"
                placeholder="Paste your experience, skills, education, and projects..."
                value={pastedText}
                onChange={(event) => setPastedText(event.target.value)}
                className="min-h-40 resize-y"
              />
              <Button
                onClick={() => void handlePasteSubmit()}
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Save resume"}
              </Button>
            </div>
          ) : (
            <PdfDropZone
              onSelect={(file) => void handleUploadFile(file)}
              busy={submitting}
              label="Upload a PDF resume"
              hint="Scanned or image-only PDFs won't work — we can only read PDFs with selectable text."
            />
          )}

          {(formError || error) && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError ?? error}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Saved resumes</CardTitle>
          <CardDescription>
            Attach any of these inside the interview setup wizard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {status === "loading" && sortedItems.length === 0 ? (
            <DocumentListSkeleton />
          ) : status === "error" ? (
            // Ahead of the empty check on purpose. This chain used to run
            // loading -> length === 0, so a failed fetch produced the cheerful
            // "add your first one" state and told the user their library was
            // empty when it was actually unreachable.
            <ErrorStateCard
              title="Couldn't load your resumes"
              description={error ?? "Something went wrong."}
              onRetry={() => void refresh()}
            />
          ) : sortedItems.length === 0 ? (
            <EmptyStateCard
              icon={<FileUser className="h-6 w-6" />}
              // Same correction as the job-description page, for the same
              // reason: the button sent someone with no CV to the wizard to
              // start an interview with one, and the form that actually solves
              // it is directly above this card.
              title="No saved CVs yet"
              description="Anything you add above is saved here, ready to reuse in any interview."
            />
          ) : (
            sortedItems.map((item, index) => {
              const isExiting = exitingId === item.id;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "group flex items-center gap-3 rounded-xl border border-border p-3 transition-colors duration-150 hover:bg-accent",
                    isExiting ? ROW_EXIT : ROW_ENTER,
                  )}
                  style={isExiting ? undefined : staggerDelay(index)}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-100 text-teal-600 shrink-0">
                    <FileUser className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => setPendingDelete(item.id)}
                    aria-label="Delete resume"
                  >
                    <Trash2 className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this resume?"
        description="The extracted text is removed permanently. Interviews that already used it keep their transcripts."
        onConfirm={async () => {
          const targetId = pendingDelete;
          setPendingDelete(null);
          if (!targetId) return;
          // Start the fade now; `remove` drops the row from state when
          // the request resolves, so the animation costs no extra time.
          setExitingId(targetId);
          const ok = await remove(targetId);
          // Put the row back if it failed; `remove` surfaced the error.
          if (!ok) setExitingId(null);
        }}
      />
    </div>
  );
}
