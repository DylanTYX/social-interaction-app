"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { History, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyStateCard } from "@/components/dashboard/empty-state-card";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { SessionListSkeleton } from "@/components/dashboard/page-skeletons";
import { BulkActionBar } from "@/components/sessions/bulk-action-bar";
import {
  RenameSessionDialog,
  type RenameTarget,
} from "@/components/sessions/rename-session-dialog";
import { SessionRow } from "@/components/sessions/session-row";
import { TagsDialog, type TagsTarget } from "@/components/sessions/tags-dialog";
import {
  useInterviewHistory,
  type InterviewSessionSummary,
} from "@/hooks/use-interview-history";
import { useSessionTags } from "@/hooks/use-session-tags";
import { CONTENT_ENTER } from "@/lib/motion";
import {
  bulkSessionsRequest,
  patchSessionRequest,
  type BulkSessionAction,
  type SessionPatch,
} from "@/lib/session-actions";
import {
  displayTitle,
  SCORE_BANDS,
  SESSION_SORTS,
  SINCE_WINDOWS,
  type ScoreBand,
  type SessionSort,
  type SinceWindow,
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
  const [scoreBand, setScoreBand] = useState<ScoreBand>("any");
  const [since, setSince] = useState<SinceWindow>("any");
  const [tagFilter, setTagFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);

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
    score: scoreBand,
    since,
    tag: tagFilter === "all" ? undefined : tagFilter,
    // The sessions page hides archived sessions unless asked. The API's own
    // default is "all", because the dashboard's statistics still count them.
    archived: showArchived ? "archived" : "active",
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
    setScoreBand("any");
    setSince("any");
    setTagFilter("all");
    setShowArchived(false);
  };

  const hasFilters =
    debouncedQuery.trim() !== "" ||
    modeFilter !== "all" ||
    statusFilter !== "all" ||
    scoreBand !== "any" ||
    since !== "any" ||
    tagFilter !== "all" ||
    showArchived;

  const isLoading = status === "loading" && sessions.length === 0;

  return (
    <div className="p-8 space-y-6">
      <PageHeader
        eyebrow="History"
        title="Your interview sessions"
        description="Every interview you've started. Rename, tag, pin or archive them, or tick two to compare attempts."
        icon={<History className="h-6 w-6" />}
        iconColor="indigo"
        actions={
          <Button asChild>
            <Link href="/simulate/setup">
              <Sparkles className="mr-2 h-4 w-4" />
              New session
            </Link>
          </Button>
        }
      />

      <Card className="shadow-soft">
        <CardContent className="space-y-3 py-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by title, scenario or persona..."
                className="pl-9"
              />
            </div>

            <Select
              value={modeFilter}
              onValueChange={(value) => setModeFilter(value as ModeFilter)}
            >
              <SelectTrigger className="w-[140px]">
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
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="abandoned">Abandoned</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Select value={sort} onValueChange={(value) => setSort(value as SessionSort)}>
              <SelectTrigger className="w-[160px]" aria-label="Sort">
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

            <Select value={scoreBand} onValueChange={(value) => setScoreBand(value as ScoreBand)}>
              <SelectTrigger className="w-[150px]" aria-label="Score">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCORE_BANDS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={since} onValueChange={(value) => setSince(value as SinceWindow)}>
              <SelectTrigger className="w-[150px]" aria-label="Date">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SINCE_WINDOWS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {tagCounts.length > 0 && (
              <Select value={tagFilter} onValueChange={setTagFilter}>
                <SelectTrigger className="w-[160px]" aria-label="Tag">
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

            <div className="ml-auto flex items-center gap-2">
              <Switch
                id="show-archived"
                checked={showArchived}
                onCheckedChange={setShowArchived}
              />
              <Label htmlFor="show-archived" className="text-sm text-slate-600">
                Show archived
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <SessionListSkeleton rows={5} />
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
            icon={<History className="h-6 w-6" />}
            title="Your first session will show up here"
            description="Run a 10-minute text or voice practice. We'll save the transcript, scores, and coaching notes so you can compare over time."
            primaryAction={{
              label: "Start a text practice",
              href: "/simulate/setup?mode=text",
            }}
            secondaryAction={{
              label: "Try voice mode",
              href: "/simulate/setup?mode=voice",
            }}
          />
        ) : (
          <Card className="border-dashed">
            <CardHeader className="items-center text-center">
              <CardTitle className="text-lg">
                {showArchived ? "No archived sessions here" : "No matching sessions"}
              </CardTitle>
              <CardDescription>
                {showArchived
                  ? "Archived sessions matching these filters would show up here."
                  : "Nothing matches the filters you have set."}
              </CardDescription>
              <Button variant="outline" size="sm" className="mt-2" onClick={clearFilters}>
                Clear filters
              </Button>
            </CardHeader>
          </Card>
        )
      ) : (
        <div className={`space-y-2 ${CONTENT_ENTER}`}>
          <BulkActionBar
            count={visibleSelected.length}
            tagSuggestions={tagSuggestions}
            showingArchived={showArchived}
            busy={bulkBusy}
            onClear={() => setSelectedIds([])}
            onArchive={(archive) => void runBulk(archive ? "archive" : "unarchive")}
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

          {/* Say how much of the result is on screen. The list used to cap at
              50 with no indication. */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="text-sm text-muted-foreground">
              Showing {sessions.length} of {total}
              {hasFilters ? " matching" : ""} session{total === 1 ? "" : "s"}
              {visibleSelected.length === 1 ? " · tick one more to compare" : ""}
            </p>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={allShownSelected}
                onChange={toggleSelectAllShown}
                className="h-4 w-4 accent-primary"
              />
              Select all shown
            </label>
          </div>

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
                  generatedTitle: session.scenarioTitle ?? session.scenarioValue,
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
                    message: session.pinned ? "Unpinned" : "Pinned to the top",
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
                      : "Archived — turn on Show archived to find it",
                    refetch: true,
                  },
                )
              }
              onDelete={() => setPendingDelete(session)}
            />
          ))}

          {hasMore && (
            <div className="pt-2 text-center">
              <Button
                variant="outline"
                onClick={() => void loadMore()}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : `Load ${PAGE_SIZE} more`}
              </Button>
            </div>
          )}
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
    </div>
  );
}
