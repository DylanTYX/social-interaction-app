"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ExternalLink,
  Eye,
  FileText,
  Pencil,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/dashboard/page-header";
import { LibraryToolbar } from "@/components/dashboard/library-toolbar";
import { EmptyStateCard } from "@/components/dashboard/empty-state-card";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { DocumentListSkeleton } from "@/components/dashboard/page-skeletons";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { JobDescriptionEditDialog } from "@/components/dashboard/job-description-edit-dialog";
import {
  emptyDraft,
  JobDescriptionAddForm,
  useJobDescriptionCreator,
  type JobDescriptionDraft,
} from "@/components/dashboard/job-description-add-form";
import { JobDescriptionPreviewDialog } from "@/components/dashboard/job-description-preview-dialog";
import {
  useJobDescriptions,
  type JobDescriptionSummary,
  type JobDescriptionUsage,
} from "@/hooks/use-job-descriptions";
import { distinctCompanies } from "@/lib/db/job-descriptions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ROW_ENTER, ROW_EXIT, staggerDelay } from "@/lib/motion";
import { describeJobDescriptionDelete } from "@/lib/job-description-copy";
import { describeTruncationBadge } from "@/lib/document-truncation";
import { JOB_DESCRIPTION_ACCENT } from "@/lib/document-accents";

export default function JobDescriptionsPage() {
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");

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
  } = useJobDescriptions({ query: debouncedQuery || undefined });

  /**
   * The company filter runs here rather than in Postgres, unlike the search.
   *
   * The two are not symmetrical. Search narrows a set the client cannot see all
   * of, so it has to run server-side or it would only ever search the rows that
   * happened to load. The company dropdown is *built from the loaded rows* — you
   * can only pick a company you can already see — so filtering it here is
   * complete by construction, and keeping it out of the fetch means `items`
   * stays the unfiltered set the options are derived from. Deriving options
   * from a server-filtered list would collapse the dropdown to whichever
   * company you had picked, with no way back to "all".
   */
  const companyOptions = useMemo(() => distinctCompanies(items), [items]);

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
  const [draft, setDraft] = useState<JobDescriptionDraft>(emptyDraft);
  const creator = useJobDescriptionCreator({ uploadText, uploadPdf });
  const [editing, setEditing] = useState<JobDescriptionSummary | null>(null);
  const [previewing, setPreviewing] = useState<JobDescriptionSummary | null>(
    null,
  );

  // Read from the debounced value, not the raw input: it decides which *empty*
  // state to show, and it must agree with the filters the list was fetched
  // with. Keying it on `query` would flash "no matches" during the 300ms
  // before the request that finds them has even gone out.
  const hasFilters = debouncedQuery.trim() !== "" || companyFilter !== "all";

  // `updatedAt` desc, numerically. It was `createdAt` with `localeCompare`,
  // which meant editing an entry never moved it — and personas, the sibling
  // library page, has always sorted by `updatedAt`.
  const sortedItems = useMemo(
    () =>
      items
        .filter(
          (item) => companyFilter === "all" || item.company === companyFilter,
        )
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [items, companyFilter],
  );

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        eyebrow="Library"
        title="Job descriptions"
        description="Save the postings you're preparing for, and reuse them across interviews. The interviewer draws its questions from the one you pick."
        icon={<FileText className="h-6 w-6" />}
        iconColor={JOB_DESCRIPTION_ACCENT}
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
            {/* Blue, not the page accent. The accent identifies this page once,
                in the header tile above; repeating it here made the upload card
                read as a green *feature* rather than as the action on this
                page — and made the resume page's identical card look like a
                different one because it was teal. */}
            <FileText className="h-4 w-4 text-primary" />
            Add a job description
          </CardTitle>
          <CardDescription>
            Paste the posting or upload it as a PDF. The text is sent to OpenAI
            to generate questions, so don&apos;t include anything you
            wouldn&apos;t want sent to a third party.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JobDescriptionAddForm
            draft={draft}
            onDraftChange={setDraft}
            busy={creator.busy}
            error={creator.error ?? error}
            onSubmitText={async () => {
              const created = await creator.submitText(draft);
              if (created) setDraft(emptyDraft());
            }}
            onSubmitFile={async (file) => {
              const created = await creator.submitFile(draft, file);
              if (created) setDraft(emptyDraft());
            }}
          />
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Saved job descriptions</CardTitle>
          <CardDescription>
            Pick any of these inside the interview setup wizard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Hidden until there is enough to search. A filter bar above three
              rows is furniture. */}
          {(items.length > 0 || hasFilters) && (
            <LibraryToolbar
              search={{
                value: query,
                onChange: setQuery,
                placeholder: "Search title, role, or company...",
                ariaLabel: "Search job descriptions",
              }}
              filters={
                companyOptions.length > 0 && (
                  <Select
                    value={companyFilter}
                    onValueChange={setCompanyFilter}
                  >
                    <SelectTrigger
                      className="w-50"
                      aria-label="Filter by company"
                    >
                      <SelectValue placeholder="Company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All companies</SelectItem>
                      {companyOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )
              }
            />
          )}

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
          ) : sortedItems.length === 0 && hasFilters ? (
            // A distinct state from an empty library: telling someone who has
            // twenty saved postings to "add their first one" because they typed
            // a typo would be nonsense.
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm font-medium text-slate-800">
                No job descriptions match those filters
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setQuery("");
                  setCompanyFilter("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : sortedItems.length === 0 ? (
            /**
             * Describes the state; it does not issue instructions.
             *
             * It used to be titled "Add a job description to ground the
             * interview" with a "Start an interview with a JD" button pointing
             * at the wizard. Both were wrong from here. The button was circular
             * — you have none, so the wizard would send you straight back to
             * add one — and the title told you to do something this card cannot
             * do, while the form that does it sat directly above, on screen.
             *
             * The description went too: this page already explains chunking and
             * embedding in the add card's header, and saying it a third time is
             * how a page ends up feeling cluttered.
             */
            <EmptyStateCard
              icon={<FileText className="h-6 w-6" />}
              title="No saved job descriptions yet"
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
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {item.title}
                    </p>
                    {/* Company leads the secondary line — it is what tells two
                        postings for the same role apart. Parts are assembled
                        and joined rather than interpolated with separators, so
                        a missing one does not leave a stranded "·". */}
                    <p className="text-xs text-slate-500 truncate">
                      {[
                        item.company,
                        item.roleTitle,
                        formatDateTime(item.createdAt),
                        describeTruncationBadge(item.truncatedFrom),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="shrink-0 rounded-md p-2 text-muted-foreground opacity-60 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Open the posting for ${item.title} in a new tab`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
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

      <JobDescriptionPreviewDialog
        item={previewing}
        onOpenChange={(open) => {
          if (!open) setPreviewing(null);
        }}
      />

      <JobDescriptionEditDialog
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
        title="Delete this job description?"
        description={describeJobDescriptionDelete(pendingUsage)}
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
