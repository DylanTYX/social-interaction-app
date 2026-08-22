"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Eye, FileUser, Pencil, Search, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/dashboard/page-header";
import { DocumentListSkeleton } from "@/components/dashboard/page-skeletons";
import { EmptyStateCard } from "@/components/dashboard/empty-state-card";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { ResumeEditDialog } from "@/components/dashboard/resume-edit-dialog";
import { ResumePreviewDialog } from "@/components/dashboard/resume-preview-dialog";
import {
  emptyResumeDraft,
  ResumeAddForm,
  useResumeCreator,
  type ResumeDraft,
} from "@/components/dashboard/resume-add-form";
import {
  useResumes,
  type ResumeSummary,
  type ResumeUsage,
} from "@/hooks/use-resumes";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ROW_ENTER, ROW_EXIT, staggerDelay } from "@/lib/motion";
import { describeResumeDelete } from "@/lib/resume-copy";
import { describeTruncationBadge } from "@/lib/document-truncation";
import { RESUME_ACCENT } from "@/lib/document-accents";

export default function ResumesPage() {
  const [query, setQuery] = useState("");

  // Debounced so a refetch does not fire on every keystroke — the same 300ms
  // the sessions page uses. Filtering runs in Postgres, so each change is a
  // request rather than an array pass.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const {
    items,
    status,
    error,
    refresh,
    uploadText,
    uploadPdf,
    update,
    remove,
    countUsage,
  } = useResumes({ query: debouncedQuery || undefined });

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  /**
   * What deleting the pending resume would affect, fetched when the dialog opens.
   *
   * `undefined` while in flight and `null` if the request failed — the dialog
   * distinguishes them from a real zero, because "no interviews use this" and
   * "we could not find out" must not read the same.
   */
  const [pendingUsage, setPendingUsage] = useState<
    ResumeUsage | null | undefined
  >(undefined);
  /**
   * Discards a usage reply that arrives after the dialog has moved to another
   * Resume — same guard, and same reason, as the one in `useLibraryList`.
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
  const [draft, setDraft] = useState<ResumeDraft>(emptyResumeDraft);
  const creator = useResumeCreator({ uploadText, uploadPdf });
  const [editing, setEditing] = useState<ResumeSummary | null>(null);
  const [previewing, setPreviewing] = useState<ResumeSummary | null>(null);

  // Read from the debounced value, not the raw input: it decides which *empty*
  // state to show, and it must agree with the filters the list was fetched
  // with. Keying it on `query` would flash "no matches" during the 300ms
  // before the request that finds them has even gone out.
  const hasFilters = debouncedQuery.trim() !== "";

  // `updatedAt` desc, numerically. It was `createdAt` with `localeCompare`,
  // which meant editing an entry never moved it — and personas, the sibling
  // library page, has always sorted by `updatedAt`. Until the PATCH route
  // existed there was nothing that could move a row; now there is.
  const sortedItems = useMemo(
    () =>
      [...items].sort(
        (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
      ),
    [items],
  );

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        eyebrow="Library"
        title="Resumes"
        description="Save the resume you're applying with, and reuse it across interviews. The interviewer reads the one you pick and asks about what's actually on it."
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
            {/* Blue, not the page accent — see the matching card on the
                job-descriptions page. The two are the same action and now look
                like it. */}
            <FileUser className="h-4 w-4 text-primary" />
            Add a resume
          </CardTitle>
          <CardDescription>
            Paste it or upload it as a PDF. The text is sent to OpenAI to
            generate questions, so don&apos;t include anything you wouldn&apos;t
            want sent to a third party.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResumeAddForm
            draft={draft}
            onDraftChange={setDraft}
            busy={creator.busy}
            error={creator.error ?? error}
            onSubmitText={async () => {
              const created = await creator.submitText(draft);
              if (created) setDraft(emptyResumeDraft());
            }}
            onSubmitFile={async (file) => {
              const created = await creator.submitFile(draft, file);
              if (created) setDraft(emptyResumeDraft());
            }}
          />
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Saved resumes</CardTitle>
          <CardDescription>
            Pick any of these inside the interview setup wizard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hidden until there is enough to search. A filter bar above three
              rows is furniture. */}
          {(items.length > 0 || hasFilters) && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title or version..."
                aria-label="Search resumes"
                className="pl-9"
              />
            </div>
          )}

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
          ) : sortedItems.length === 0 && hasFilters ? (
            // A distinct state from an empty library: telling someone with
            // several saved resumes to "add their first one" because they typed a
            // typo would be nonsense.
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium text-slate-800">
                No resumes match that search
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => setQuery("")}
              >
                Clear search
              </Button>
            </div>
          ) : sortedItems.length === 0 ? (
            <EmptyStateCard
              icon={<FileUser className="h-6 w-6" />}
              // Describes the state; it does not issue instructions. The button
              // that used to be here sent someone with no resume to the wizard to
              // start an interview with one, while the form that actually
              // solves it sits directly above.
              title="No saved resumes yet"
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
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-muted text-primary shrink-0">
                    <FileUser className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {item.title}
                    </p>
                    {/* The version leads the secondary line — it is what tells
                        two resumes for two kinds of role apart. Parts are assembled
                        and joined rather than interpolated with separators, so
                        a missing one does not leave a stranded "·". */}
                    <p className="text-xs text-slate-500 truncate">
                      {[
                        item.variant,
                        formatDateTime(item.createdAt),
                        describeTruncationBadge(item.truncatedFrom),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => setPreviewing(item)}
                    aria-label={`Preview ${item.title}`}
                  >
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => setEditing(item)}
                    aria-label={`Edit ${item.title}`}
                  >
                    <Pencil className="h-4 w-4 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => openDeleteDialog(item.id)}
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

      <ResumePreviewDialog
        item={previewing}
        onOpenChange={(open) => {
          if (!open) setPreviewing(null);
        }}
      />

      <ResumeEditDialog
        item={editing}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSave={async (id, patch) => Boolean(await update(id, patch))}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setPendingUsage(undefined);
          }
        }}
        title="Delete this resume?"
        description={describeResumeDelete(pendingUsage)}
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
