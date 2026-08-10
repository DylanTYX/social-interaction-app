"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  History,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Search,
  Sparkles,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyStateCard } from "@/components/dashboard/empty-state-card";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { SessionListSkeleton } from "@/components/dashboard/page-skeletons";
import {
  useInterviewHistory,
  type InterviewSessionSummary,
} from "@/hooks/use-interview-history";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  CONTENT_ENTER,
  ROW_ENTER,
  ROW_EXIT,
  staggerDelay,
} from "@/lib/motion";
import { toast } from "sonner";
import { InitialsAvatar } from "@/components/ui/initials-avatar";

type ModeFilter = "all" | "text" | "voice";
type StatusFilter = "all" | "in_progress" | "completed" | "abandoned";

const STATUS_TONE: Record<InterviewSessionSummary["status"], string> = {
  in_progress: "border-orange-200 bg-orange-50 text-orange-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  abandoned: "border-gray-200 bg-gray-50 text-gray-600",
};

const STATUS_LABEL: Record<InterviewSessionSummary["status"], string> = {
  in_progress: "In progress",
  completed: "Completed",
  abandoned: "Abandoned",
};

const PAGE_SIZE = 25;

export default function SessionsLibraryPage() {
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

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
  } = useInterviewHistory(PAGE_SIZE, {
    query: debouncedQuery,
    mode: modeFilter === "all" ? undefined : modeFilter,
    status: statusFilter === "all" ? undefined : statusFilter,
  });

  const [pendingDelete, setPendingDelete] =
    useState<InterviewSessionSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  // The row being animated out. Set before the request goes out, so the list
  // responds the moment the user confirms rather than after a round trip.
  const [exitingId, setExitingId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const targetId = pendingDelete.id;
    setDeleting(true);
    // Dismiss the dialog and start the row fading before the request goes out.
    // Both matter: the fade is the feedback, and it is behind the dialog's
    // overlay until the dialog is gone, so leaving the dialog up until the
    // delete resolved meant the animation was never actually seen.
    setPendingDelete(null);
    setExitingId(targetId);
    try {
      const response = await fetch(`/api/sessions/${targetId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete the session.");
      toast.success("Session deleted");
      // `refresh` sets status to "loading", but the page only shows a skeleton
      // when the list is empty — so the rows stay put while it refetches.
      await refresh();
    } catch {
      // Put the row back. It is still in the list, so clearing the marker is
      // enough to restore it.
      setExitingId(null);
      toast.error("Could not delete that session. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  // `sessions` is already the filtered page — the server did it.
  const filtered = sessions;
  const hasFilters =
    debouncedQuery.trim() !== "" ||
    modeFilter !== "all" ||
    statusFilter !== "all";

  const isLoading = status === "loading" && sessions.length === 0;

  return (
    <div className="p-8 space-y-8 bg-linear-to-br from-gray-50 via-white to-gray-50/50">
      <PageHeader
        eyebrow="History"
        title="Your interview sessions"
        description="Every interview you've started, with searchable scenario, persona, and status. Click any session to revisit its full transcript and scores."
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
        <CardContent className="flex flex-wrap items-center gap-3 py-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by scenario or persona..."
              className="pl-9"
            />
          </div>

          <Select
            value={modeFilter}
            onValueChange={(value) => setModeFilter(value as ModeFilter)}
          >
            <SelectTrigger className="w-[150px]">
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
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="in_progress">In progress</SelectItem>
              <SelectItem value="abandoned">Abandoned</SelectItem>
            </SelectContent>
          </Select>
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
      ) : filtered.length === 0 ? (
        // `sessions.length` used to tell these two apart, but the server now
        // returns only matching rows, so an empty list looks identical in both
        // cases. Whether any filter is set is the honest signal.
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
          // Told the user to "clear your filters" and gave them no way to do
          // it — three controls to reset by hand, from a state whose whole
          // point is that the user is stuck.
          <Card className="border-dashed">
            <CardHeader className="items-center text-center">
              <CardTitle className="text-lg">No matching sessions</CardTitle>
              <CardDescription>
                Nothing matches the filters you have set.
              </CardDescription>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setQuery("");
                  setModeFilter("all");
                  setStatusFilter("all");
                }}
              >
                Clear filters
              </Button>
            </CardHeader>
          </Card>
        )
      ) : (
        <div className={cn("space-y-2", CONTENT_ENTER)}>
          {/* Say how much of the result is on screen. The list used to cap at
              50 with no indication, so session 51 simply did not exist as far
              as the UI was concerned. */}
          <p className="px-1 text-sm text-muted-foreground">
            Showing {filtered.length} of {total}
            {hasFilters ? " matching" : ""} session{total === 1 ? "" : "s"}
          </p>
          {filtered.map((session, index) => {
            const ModeIcon =
              session.practiceMode === "voice" ? Mic : MessageSquare;
            const isExiting = exitingId === session.id;
            return (
              // The row is a Link, so the menu cannot live inside it — a button
              // nested in an anchor is invalid markup and the anchor swallows
              // the click. The wrapper is the positioning context; the Link
              // fills it and the menu sits on top.
              <div
                key={session.id}
                className={cn(
                  "group relative",
                  isExiting ? ROW_EXIT : ROW_ENTER,
                )}
                style={isExiting ? undefined : staggerDelay(index)}
              >
                <Link
                  href={
                    session.status === "in_progress"
                      ? session.practiceMode === "voice"
                        ? `/simulate/voice?session=${session.id}`
                        : `/simulate/chat?session=${session.id}`
                      : `/simulate/report/${session.id}`
                  }
                  className="block rounded-xl border border-border p-4 pr-14 transition-colors duration-150 hover:bg-accent"
                >
                  <div className="flex items-center gap-4">
                    <InitialsAvatar name={session.personaName} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 truncate">
                          {session.scenarioTitle ?? session.scenarioValue}
                        </p>
                        <Badge
                          variant="outline"
                          className={STATUS_TONE[session.status]}
                        >
                          {STATUS_LABEL[session.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-gray-500 flex items-center gap-2 flex-wrap">
                        <span>{session.personaName}</span>
                        <span>·</span>
                        <span>{formatRelativeDate(session.createdAt)}</span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1">
                          <ModeIcon className="h-3 w-3" />
                          {session.practiceMode === "voice" ? "Voice" : "Text"}
                        </span>
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-blue-600">
                        {session.averageScore === null
                          ? "—"
                          : `${session.averageScore}%`}
                      </div>
                      <p className="text-xs text-muted-foreground">score</p>
                    </div>
                  </div>
                </Link>

                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        aria-label={`Actions for ${session.scenarioTitle ?? session.scenarioValue}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => setPendingDelete(session)}
                      >
                        Delete session
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}

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

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setPendingDelete(null);
        }}
        title="Delete this session?"
        description={
          pendingDelete
            ? `The transcript, every score and any coaching answers for "${
                pendingDelete.scenarioTitle ?? pendingDelete.scenarioValue
              }" are removed permanently.${
                // A loop is N sessions sharing a loop_id, so removing one round
                // silently changes the loop report's first-to-last improvement
                // figure. Worth saying before, not discovering after.
                pendingDelete.status === "completed"
                  ? " If it was part of an interview loop, that loop's report will lose this round."
                  : ""
              }`
            : ""
        }
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
