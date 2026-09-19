"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PageContainer,
  PageHeader,
  PANEL_LABEL,
} from "@/components/dashboard/page-header";
import { EmptyStateCard } from "@/components/dashboard/empty-state-card";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { SessionListSkeleton } from "@/components/dashboard/page-skeletons";
import { BulkActionBar } from "@/components/sessions/bulk-action-bar";
import {
  RenameSessionDialog,
  type RenameTarget,
} from "@/components/sessions/rename-session-dialog";
import { SESSION_GRID, SessionRow } from "@/components/sessions/session-row";
import { TagsDialog, type TagsTarget } from "@/components/sessions/tags-dialog";
import {
  useInterviewHistory,
  type InterviewSessionSummary,
} from "@/hooks/use-interview-history";
import { useSessionTags } from "@/hooks/use-session-tags";
import { CONTENT_ENTER } from "@/lib/motion";
import { cn } from "@/lib/utils";
import {
  bulkSessionsRequest,
  patchSessionRequest,
  type BulkSessionAction,
  type SessionPatch,
} from "@/lib/session-actions";
import {
  displayTitle,
  SESSION_SORTS,
  type SessionSort,
} from "@/lib/session-organisation";

type ModeFilter = "all" | "text" | "voice";
type StatusFilter = "all" | "in_progress" | "completed" | "abandoned";

const PAGE_SIZE = 25;

/**
 * Every session, and the tools to keep a growing history usable: rename, tag,
 * pin, archive, sort and filter, act on several at once, and compare two
 * attempts.
 *
 * Organisation changes go through the same session PATCH as everything else,
 * and a change that moves a row out of the current view (pin reorders, archive
 * hides) refetches rather than guessing
 * where the row now belongs.
 */
export default function SessionsLibraryPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SessionSort>("newest");
  const [tagFilter, setTagFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const wantedArchived = showArchived ? "archived" : "active";

  // Debounced so a refetch does not fire on every keystroke. The filter runs in
  // Postgres now, so each change is a request rather than an array pass.
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const {
    sessions,
    status,
    loadedArchived,
    error,
    refresh,
    loadMore,
    total,
    hasMore,
    loadingMore,
    patchLocal,
  } = useInterviewHistory(PAGE_SIZE, {
    query: debouncedQuery,
    mode: modeFilter === "all" ? undefined : modeFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
    sort,
    tag: tagFilter === "all" ? undefined : tagFilter,
    // The sessions page hides archived sessions unless asked. The API's own
    // default is "all", because the dashboard's statistics still count them.
    archived: wantedArchived,
  });

  const { tags: tagCounts, refresh: refreshTags } = useSessionTags();
  const tagSuggestions = tagCounts.map((entry) => entry.tag);

  // Kept in the order the boxes were ticked, so Compare's "first" and "second"
  // are the ones the user chose in that order.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const visibleSelected = selectedIds.filter((id) =>
    sessions.some((session) => session.id === id),
  );
  const [bulkBusy, setBulkBusy] = useState(false);

  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [tagsTarget, setTagsTarget] = useState<TagsTarget | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<InterviewSessionSummary | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // The row being animated out. Set before the request goes out, so the list
  // responds the moment the user confirms rather than after a round trip.
  const [exitingId, setExitingId] = useState<string | null>(null);

  const toggleSelect = (id: string) =>
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );

  const allShownSelected =
    sessions.length > 0 &&
    sessions.every((session) => selectedIds.includes(session.id));
  const someShownSelected = !allShownSelected && visibleSelected.length > 0;

  // "Some ticked" is a real third state for the heading checkbox, and only a
  // property can express it.
  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someShownSelected;
    }
  }, [someShownSelected]);
  const toggleSelectAllShown = () =>
    setSelectedIds((current) =>
      allShownSelected
        ? current.filter((id) => !sessions.some((session) => session.id === id))
        : [
            ...current,
            ...sessions
              .map((session) => session.id)
              .filter((id) => !current.includes(id)),
          ],
    );

  const applyPatch = async (
    session: InterviewSessionSummary,
    patch: SessionPatch,
    options: { message?: string; refetch?: boolean } = {},
  ) => {
    try {
      const updated = await patchSessionRequest(session.id, patch);
      patchLocal(session.id, updated);
      if (options.message) toast.success(options.message);
      if (options.refetch) await refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't update that session.",
      );
    }
  };

  const runBulk = async (
    action: BulkSessionAction,
    extra: { tag?: string } = {},
  ) => {
    const ids = visibleSelected;
    if (ids.length === 0) return;
    setBulkBusy(true);
    try {
      const { updated, failed } = await bulkSessionsRequest({
        ids,
        action,
        ...extra,
      });
      const verb = action === "delete" ? "deleted" : "updated";
      toast.success(
        failed > 0
          ? `${updated} ${verb}, ${failed} couldn't be changed`
          : `${updated} session${updated === 1 ? "" : "s"} ${verb}`,
      );
      setSelectedIds([]);
      await Promise.all([refresh(), refreshTags()]);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't update those sessions.",
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const targetId = pendingDelete.id;
    setDeleting(true);
    // Dismiss the dialog and start the row fading before the request goes out.
    // The fade is behind the dialog's overlay until the dialog is gone.
    setPendingDelete(null);
    setExitingId(targetId);
    try {
      const response = await fetch(`/api/sessions/${targetId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete the session.");
      toast.success("Session deleted");
      setSelectedIds((current) => current.filter((id) => id !== targetId));
      await Promise.all([refresh(), refreshTags()]);
    } catch {
      setExitingId(null);
      toast.error("Could not delete that session. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  const clearFilters = () => {
    setQuery("");
    setModeFilter("all");
    setStatusFilter("all");
    setTagFilter("all");
    setShowArchived(false);
  };

  // The toolbar's Clear leaves the tab alone: Archived is a place you chose,
  // not a filter you forgot you set.
  const clearNarrowing = () => {
    setQuery("");
    setModeFilter("all");
    setStatusFilter("all");
    setTagFilter("all");
  };
  const isNarrowed =
    query.trim() !== "" ||
    modeFilter !== "all" ||
    statusFilter !== "all" ||
    tagFilter !== "all";

  const hasFilters =
    debouncedQuery.trim() !== "" ||
    modeFilter !== "all" ||
    statusFilter !== "all" ||
    tagFilter !== "all" ||
    showArchived;

  /**
   * Switching tab is a fresh load, not a filtered one.
   *
   * `isLoading` used to require an empty list, so moving from Active to
   * Archived showed the *Active* rows, unchanged, for as long as the request
   * took — no spinner, no skeleton, nothing to say anything was happening. The
   * page looked frozen, and then the list silently became a different list.
   *
   * A tab is a different place, so its stale rows are worse than no rows:
   * leaving them up says "these are your archived sessions" while they are not.
   * Other filter changes keep their rows and dim instead (`refetching` below),
   * because there the old rows are a near-miss rather than the wrong answer.
   */
  const switchingTab =
    status === "loading" &&
    loadedArchived !== undefined &&
    loadedArchived !== wantedArchived;

  const isLoading =
    status === "loading" && (sessions.length === 0 || switchingTab);
  /** A refetch under a list that is still worth looking at: search, sort, tags. */
  const refetching = status === "loading" && !isLoading;

  return (
    <PageContainer>
      <PageHeader
        title="Sessions"
        description="Every interview you've run. Open one for its report, or tick two to compare."
        actions={
          <Button asChild>
            <Link href="/simulate/setup">
              <Plus />
              New interview
            </Link>
          </Button>
        }
      />

      <div className="space-y-4">
        {/* Archived is a separate place, so it is a tab rather than a switch
            among the filters. The underline is the landing header's. */}
        <div
          className="flex items-center gap-6 border-b border-slate-200"
          aria-label="Which sessions"
          role="group"
        >
          {[
            { archived: false, label: "Active" },
            { archived: true, label: "Archived" },
          ].map((tab) => {
            const current = showArchived === tab.archived;
            return (
              <button
                key={tab.label}
                type="button"
                aria-pressed={current}
                onClick={() => setShowArchived(tab.archived)}
                className={cn(
                  "-mb-px border-b-2 pb-3 text-sm font-medium transition-colors duration-150",
                  "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-muted",
                  current
                    ? "border-primary text-slate-900"
                    : "border-transparent text-slate-500 hover:text-slate-900",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* No card around the controls: they act on the list below, and a
            card of selects above a card of rows read as two separate things. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, scenario or persona…"
              aria-label="Search sessions"
              className="pl-9"
            />
          </div>

          <Select
            value={modeFilter}
            onValueChange={(value) => setModeFilter(value as ModeFilter)}
          >
            <SelectTrigger className="w-auto min-w-32 flex-1 basis-[calc(50%-0.25rem)] sm:flex-none sm:basis-auto" aria-label="Mode">
              <SelectValue placeholder="Mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modes</SelectItem>
              <SelectItem value="text">Text</SelectItem>
              <SelectItem value="voice">Voice</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(value) => setStatusFilter(value as StatusFilter)}
          >
            <SelectTrigger className="w-auto min-w-36 flex-1 basis-[calc(50%-0.25rem)] sm:flex-none sm:basis-auto" aria-label="Status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="abandoned">Abandoned</SelectItem>
            </SelectContent>
          </Select>

          {tagCounts.length > 0 && (
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-auto min-w-32 flex-1 basis-[calc(50%-0.25rem)] sm:flex-none sm:basis-auto" aria-label="Tag">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {tagCounts.map((entry) => (
                  <SelectItem key={entry.tag} value={entry.tag}>
                    {entry.tag} ({entry.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {isNarrowed && (
            <Button variant="ghost" size="sm" onClick={clearNarrowing}>
              Clear
            </Button>
          )}

          {/* Below `sm` the filters tile two to a row and fill it, and the sort
              is one of them: with `ml-auto` it sat alone on a third row, pushed to
              the right edge, looking like it had fallen off the toolbar. */}
          <div className="flex flex-1 basis-[calc(50%-0.25rem)] items-center gap-2 sm:ml-auto sm:flex-none sm:basis-auto">
            <span className="hidden text-sm text-slate-500 sm:inline">
              Sort
            </span>
            <Select
              value={sort}
              onValueChange={(value) => setSort(value as SessionSort)}
            >
              <SelectTrigger className="w-auto min-w-36 flex-1 sm:flex-none" aria-label="Sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SESSION_SORTS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-soft">
          <div className="h-11 border-b border-slate-200" />
          <div className="p-2">
            <SessionListSkeleton rows={5} />
          </div>
        </div>
      ) : status === "error" ? (
        // Before this branch existed, a failed load fell through to the empty
        // state and told the user they had never run a session.
        <ErrorStateCard
          title="Couldn't load your sessions"
          description={error}
          onRetry={() => void refresh()}
        />
      ) : sessions.length === 0 ? (
        // The server returns only matching rows, so an empty list looks the
        // same whether the user has no sessions or the filters hide them all.
        // Whether any filter is set is the honest signal.
        !hasFilters ? (
          <EmptyStateCard
            title="Your first session will show up here"
            description="Run a voice or text interview. The transcript, scores and coaching are saved so you can compare attempts over time."
            primaryAction={{
              label: "Start a voice interview",
              href: "/simulate/setup?mode=voice",
            }}
            secondaryAction={{
              label: "Start a text interview",
              href: "/simulate/setup?mode=text",
            }}
          />
        ) : (
          <EmptyStateCard
            title={
              showArchived
                ? "No archived sessions here"
                : "No matching sessions"
            }
            description={
              showArchived
                ? "Archived sessions matching these filters would show up here."
                : "Nothing matches the filters you have set."
            }
            primaryAction={{ label: "Clear filters", onClick: clearFilters }}
          />
        )
      ) : (
        // One card holding one list: a heading row, hairline rows, and a
        // footer that says how much of the result is on screen.
        <div
          // `aria-busy` and the fade are the only signal a refetch is running
          // when rows are already on screen — a search keystroke, a sort, a tag.
          // Without it the list simply changes under the user with no sign that
          // anything was asked for.
          aria-busy={refetching}
          className={cn(
            "rounded-xl border border-slate-200 bg-white shadow-soft",
            CONTENT_ENTER,
            refetching && "opacity-60 transition-opacity duration-150",
          )}
        >
          <div
            className={cn(
              "sticky top-0 z-20 rounded-t-xl border-b border-slate-200 transition-colors duration-150",
              visibleSelected.length > 0 ? "bg-primary-subtle" : "bg-white",
            )}
          >
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={allShownSelected}
              onChange={toggleSelectAllShown}
              aria-label="Select all shown"
              className="absolute top-1/2 left-5 z-10 h-4 w-4 -translate-y-1/2 cursor-pointer accent-primary"
            />
            {visibleSelected.length > 0 ? (
              <BulkActionBar
                count={visibleSelected.length}
                tagSuggestions={tagSuggestions}
                showingArchived={showArchived}
                busy={bulkBusy}
                onClear={() => setSelectedIds([])}
                onArchive={(archive) =>
                  void runBulk(archive ? "archive" : "unarchive")
                }
                onPin={(pin) => void runBulk(pin ? "pin" : "unpin")}
                onAddTag={(tag) => void runBulk("add_tag", { tag })}
                onDelete={() => setPendingBulkDelete(true)}
                onCompare={
                  visibleSelected.length === 2
                    ? () =>
                        router.push(
                          `/dashboard/sessions/compare?a=${visibleSelected[0]}&b=${visibleSelected[1]}`,
                        )
                    : null
                }
              />
            ) : (
              <div className={cn(SESSION_GRID, "h-11")}>
                <span className={PANEL_LABEL}>Session</span>
                <span className={cn(PANEL_LABEL, "hidden md:block")}>Mode</span>
                <span className={cn(PANEL_LABEL, "hidden md:block")}>Date</span>
                <span className={cn(PANEL_LABEL, "hidden text-right sm:block")}>Score</span>
              </div>
            )}
          </div>

          <ul className="divide-y divide-slate-100">
            {sessions.map((session, index) => (
              <SessionRow
                key={session.id}
                session={session}
                index={index}
                exiting={exitingId === session.id}
                selected={selectedIds.includes(session.id)}
                onToggleSelect={() => toggleSelect(session.id)}
                onRename={() =>
                  setRenameTarget({
                    id: session.id,
                    title: session.title ?? null,
                    generatedTitle:
                      session.scenarioTitle ?? session.scenarioValue,
                  })
                }
                onEditTags={() =>
                  setTagsTarget({
                    id: session.id,
                    title: displayTitle(session),
                    tags: session.tags ?? [],
                  })
                }
                onTogglePin={() =>
                  void applyPatch(
                    session,
                    { pinned: !session.pinned },
                    {
                      message: session.pinned
                        ? "Unpinned"
                        : "Pinned to the top",
                      refetch: true,
                    },
                  )
                }
                onToggleArchive={() =>
                  void applyPatch(
                    session,
                    { archived: !session.archivedAt },
                    {
                      message: session.archivedAt
                        ? "Moved back to your sessions"
                        : "Archived. Find it under the Archived tab.",
                      refetch: true,
                    },
                  )
                }
                onDelete={() => setPendingDelete(session)}
              />
            ))}
          </ul>

          {/* Say how much of the result is on screen. The list used to cap at
              50 with no indication. */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
            <p className="text-sm text-slate-500 tabular-nums">
              Showing {sessions.length} of {total}
              {hasFilters ? " matching" : ""} session{total === 1 ? "" : "s"}
            </p>
            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : `Load ${PAGE_SIZE} more`}
              </Button>
            )}
          </div>
        </div>
      )}

      <RenameSessionDialog
        target={renameTarget}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        onRenamed={(id, title) => patchLocal(id, { title })}
      />

      <TagsDialog
        target={tagsTarget}
        suggestions={tagSuggestions}
        onOpenChange={(open) => {
          if (!open) setTagsTarget(null);
        }}
        onChange={(id, tags) => {
          patchLocal(id, { tags });
          setTagsTarget((current) =>
            current && current.id === id ? { ...current, tags } : current,
          );
          void refreshTags();
        }}
      />

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
        title="Delete this session?"
        description={
          pendingDelete
            ? `The transcript, every score and any coaching answers for "${displayTitle(
                pendingDelete,
              )}" are removed permanently.${
                // A loop is N sessions sharing a loop_id, so removing one round
                // silently changes the loop report's improvement figure.
                pendingDelete.status === "completed"
                  ? " If it was part of an interview loop, that loop's report will lose this round."
                  : ""
              } Archive it instead to keep the history.`
            : ""
        }
        onConfirm={() => void handleDelete()}
      />

      <ConfirmDeleteDialog
        open={pendingBulkDelete}
        onOpenChange={setPendingBulkDelete}
        title={`Delete ${visibleSelected.length} session${visibleSelected.length === 1 ? "" : "s"}?`}
        description="Their transcripts, scores and coaching answers are removed permanently. Archive them instead to keep the history."
        confirmLabel="Delete sessions"
        onConfirm={async () => {
          setPendingBulkDelete(false);
          await runBulk("delete");
        }}
      />
    </PageContainer>
  );
}
