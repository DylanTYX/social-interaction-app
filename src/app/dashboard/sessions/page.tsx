"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  History,
  MessageSquare,
  Mic,
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

type ModeFilter = "all" | "text" | "voice";
type StatusFilter = "all" | "in_progress" | "completed" | "abandoned";

function formatRelativeDate(generatedAt: string): string {
  const ts = Date.parse(generatedAt);
  if (Number.isNaN(ts)) return "";

  const diffMs = Date.now() - ts;
  const minutes = Math.round(diffMs / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  return new Date(ts).toLocaleDateString();
}

function buildAvatar(name: string): string {
  if (!name) return "??";
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

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

export default function SessionsLibraryPage() {
  const { sessions, status, error, refresh } = useInterviewHistory(50);

  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<ModeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return sessions.filter((session) => {
      if (modeFilter !== "all" && session.practiceMode !== modeFilter) {
        return false;
      }
      if (statusFilter !== "all" && session.status !== statusFilter) {
        return false;
      }
      if (!normalized) return true;
      const haystack =
        `${session.scenarioTitle ?? session.scenarioValue} ${session.personaName}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [sessions, query, modeFilter, statusFilter]);

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
          <Link href="/simulate/setup">
            <Button>
              <Sparkles className="mr-2 h-4 w-4" />
              New session
            </Button>
          </Link>
        }
      />

      <Card className="border border-gray-200/80 shadow-soft">
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
        sessions.length === 0 ? (
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
            <CardHeader className="text-center">
              <CardTitle className="text-lg">No matching sessions</CardTitle>
              <CardDescription>
                Try a different search or clear your filters.
              </CardDescription>
            </CardHeader>
          </Card>
        )
      ) : (
        <div className="space-y-2">
          {filtered.map((session) => {
            const ModeIcon =
              session.practiceMode === "voice" ? Mic : MessageSquare;
            return (
              <Link
                key={session.id}
                href={
                  session.status === "in_progress"
                    ? session.practiceMode === "voice"
                      ? `/simulate/voice?session=${session.id}`
                      : `/simulate/chat?session=${session.id}`
                    : `/simulate/report/${session.id}`
                }
                className="block rounded-xl border border-gray-200/70 bg-white p-4 transition-all duration-200 hover:border-indigo-200 hover:shadow-soft-md"
              >
                <div className="flex items-center gap-4">
                  <div className="h-11 w-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                    {buildAvatar(session.personaName)}
                  </div>
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
                    <p className="text-xs text-gray-400">score</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
