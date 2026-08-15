"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Trash2, Upload, Sparkles } from "lucide-react";
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
import { EmptyStateCard } from "@/components/dashboard/empty-state-card";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { DocumentListSkeleton } from "@/components/dashboard/page-skeletons";
import {
  useJobDescriptions,
  type JobDescriptionUsage,
} from "@/hooks/use-job-descriptions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ROW_ENTER, ROW_EXIT, staggerDelay } from "@/lib/motion";

/**
 * What the user is about to lose, stated as specifically as we can manage.
 *
 * The old copy ended "Existing transcripts are unaffected." True of the message
 * rows, and it reads as "nothing in flight is harmed" — which is exactly wrong
 * for an interview still in progress. Those sessions survive the delete (the FK
 * is `on delete set null`) but lose their grounding the moment they resume: no
 * job context in the interviewer's prompt, and none in the scoring pass either,
 * so the rest of the session is judged against a different bar than the start
 * of it.
 *
 * Follows the two-beat shape used for session deletes: state what goes, then
 * append the downstream consequence only when it actually applies. While the
 * count is loading or if it failed, say the general thing rather than guessing
 * — a wrong number here is worse than no number.
 */
function describeDeleteConsequences(
  usage: JobDescriptionUsage | null | undefined,
): string {
  const base =
    "This also deletes its embedded chunks, so interviews can no longer retrieve context from it. Completed transcripts and their scores are unaffected.";

  if (!usage || usage.inProgress === 0) return base;

  const count =
    usage.inProgress === 1
      ? "1 interview that is still in progress uses"
      : `${usage.inProgress} interviews that are still in progress use`;

  return `${base} ${count} it, and will carry on without it when you resume.`;
}

export default function JobDescriptionsPage() {
  const {
    items,
    status,
    error,
    refresh,
    uploadText,
    uploadPdf,
    remove,
    countUsage,
  } = useJobDescriptions();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  /**
   * What deleting the pending JD would affect, fetched when the dialog opens.
   *
   * `undefined` while in flight and `null` if the request failed — the dialog
   * distinguishes them from a real zero, because "no interviews use this" and
   * "we could not find out" must not read the same.
   */
  const [pendingUsage, setPendingUsage] = useState<
    JobDescriptionUsage | null | undefined
  >(undefined);
  /**
   * Discards a usage reply that arrives after the dialog has moved to another
   * JD — same guard, and same reason, as the one in `useLibraryList`. Open A,
   * close it, open B quickly and A's slower reply would otherwise land as B's
   * count.
   */
  const usageRequestRef = useRef(0);

  const openDeleteDialog = (id: string) => {
    const requestId = usageRequestRef.current + 1;
    usageRequestRef.current = requestId;
    setPendingDelete(id);
    setPendingUsage(undefined);
    // Started on the click rather than from an effect, so it has the time the
    // dialog spends animating in. `countUsage` never rejects — a failure
    // resolves to null and the copy falls back to the general form.
    void countUsage(id).then((usage) => {
      if (usageRequestRef.current === requestId) setPendingUsage(usage);
    });
  };
  // The row being animated out. Set before the request goes out, so the
  // list responds the moment the user confirms rather than after a round trip.
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [roleTitle, setRoleTitle] = useState("");
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
      setFormError("Paste at least 80 characters of job description text.");
      return;
    }
    setSubmitting(true);
    const created = await uploadText({
      rawText: pastedText,
      roleTitle: roleTitle.trim() || null,
    });
    setSubmitting(false);
    if (created) {
      setPastedText("");
      setRoleTitle("");
    }
  };

  const handleUploadFile = async (file: File) => {
    setFormError(null);
    setSubmitting(true);
    const created = await uploadPdf({
      file,
      roleTitle: roleTitle.trim() || null,
    });
    setSubmitting(false);
    if (created) {
      setRoleTitle("");
    }
  };

  return (
    <div className="p-8 space-y-8 bg-linear-to-br from-gray-50 via-white to-gray-50/50">
      <PageHeader
        eyebrow="Library"
        title="Job descriptions"
        description="Upload or paste job descriptions and reuse them across interviews. We embed and chunk them once so the interviewer pulls only the most relevant excerpts on each turn."
        icon={<FileText className="h-6 w-6" />}
        iconColor="green"
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
            <FileText className="h-4 w-4 text-indigo-600" />
            Add a job description
          </CardTitle>
          <CardDescription>
            We embed and chunk it once so the interviewer can pull only the
            relevant excerpts on each turn. Both the embedding and the questions
            are generated by OpenAI, so the text is sent there.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* The last hand-rolled chips. These were ~34px with no
              `aria-pressed` and no focus ring, so selection was colour-only —
              and each page picked a different accent (indigo here) that
              matched neither its own header tile nor the other page. */}
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
            <Label htmlFor="role-title">Applied role title (optional)</Label>
            <Input
              id="role-title"
              placeholder="e.g. Senior Product Manager"
              value={roleTitle}
              onChange={(event) => setRoleTitle(event.target.value)}
            />
          </div>

          {mode === "paste" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="paste-text">Job description text</Label>
                <span className="text-xs text-gray-500">
                  {pastedText.trim().length} chars
                </span>
              </div>
              <Textarea
                id="paste-text"
                placeholder="Paste responsibilities, requirements, and context..."
                value={pastedText}
                onChange={(event) => setPastedText(event.target.value)}
                className="min-h-40 resize-y"
              />
              <Button
                onClick={() => void handlePasteSubmit()}
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Save job description"}
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) {
                    void handleUploadFile(file);
                  }
                }}
              />
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-gray-800">
                  Upload a PDF job description
                </p>
                <p className="text-xs text-gray-500">
                  Image-only PDFs are not supported in this version.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {submitting ? "Uploading..." : "Choose PDF"}
                </Button>
              </div>
            </div>
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
          <CardTitle className="text-base">Saved job descriptions</CardTitle>
          <CardDescription>
            Pick any of these inside the interview setup wizard.
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
              title="Couldn't load your job descriptions"
              description={error ?? "Something went wrong."}
              onRetry={() => void refresh()}
            />
          ) : sortedItems.length === 0 ? (
            <EmptyStateCard
              icon={<FileText className="h-6 w-6" />}
              title="Add a job description to ground the interview"
              description="Paste the posting or upload a PDF once — we'll pull the most relevant bullets into each question."
              primaryAction={{
                label: "Start an interview with a JD",
                href: "/simulate/setup",
              }}
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
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-600 shrink-0">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {item.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {item.roleTitle ?? "No role title"} ·{" "}
                      {formatDateTime(item.createdAt)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => openDeleteDialog(item.id)}
                    aria-label="Delete job description"
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
          if (!open) {
            setPendingDelete(null);
            setPendingUsage(undefined);
          }
        }}
        title="Delete this job description?"
        description={describeDeleteConsequences(pendingUsage)}
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
