"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  Clock,
  Target,
  ChevronRight,
  Sparkles,
  Mic,
  MessageSquare,
  ArrowRight,
  PlayCircle,
  Dumbbell,
} from "lucide-react";
import {
  useInterviewHistory,
  type InterviewSessionSummary,
} from "@/hooks/use-interview-history";
import { useCurrentUser, getDisplayName } from "@/hooks/use-current-user";
import { getSuggestedNextSession } from "@/lib/recommendations";
import { OnboardingDialog } from "@/components/dashboard/onboarding-dialog";
import { OnboardingTour } from "@/components/dashboard/onboarding-tour";
import { GoalsCard } from "@/components/dashboard/goals-card";
import { SessionListSkeleton } from "@/components/dashboard/page-skeletons";
import { useJobDescriptions } from "@/hooks/use-job-descriptions";

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

  const weeks = Math.round(days / 7);
  if (weeks < 5) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;

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

interface DashboardStats {
  total: number;
  averageScore: number | null;
  totalMinutes: number;
  streakDays: number;
}

function computeStats(sessions: InterviewSessionSummary[]): DashboardStats {
  const total = sessions.length;
  const scored = sessions.filter(
    (entry): entry is InterviewSessionSummary & { averageScore: number } =>
      typeof entry.averageScore === "number",
  );
  const averageScore =
    scored.length > 0
      ? Math.round(
          scored.reduce((sum, entry) => sum + entry.averageScore, 0) /
            scored.length,
        )
      : null;

  const totalMinutes = sessions.reduce(
    (sum, entry) => sum + (entry.durationMinutes ?? 0),
    0,
  );

  const sortedDates = sessions
    .map((entry) => Date.parse(entry.createdAt))
    .filter((ts) => !Number.isNaN(ts))
    .sort((a, b) => b - a);

  let streakDays = 0;
  if (sortedDates.length > 0) {
    const dayKey = (ms: number) => new Date(ms).toDateString();
    const seen = new Set(sortedDates.map(dayKey));
    const today = new Date();
    for (let offset = 0; offset < 30; offset += 1) {
      const probe = new Date(today);
      probe.setDate(today.getDate() - offset);
      if (seen.has(probe.toDateString())) {
        streakDays += 1;
      } else if (offset > 0) {
        break;
      }
    }
  }

  return { total, averageScore, totalMinutes, streakDays };
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 22) return "Good evening";
  return "Up late";
}

interface StatRowProps {
  icon: React.ReactNode;
  iconColor: "blue" | "purple" | "teal" | "orange";
  label: string;
  value: string;
  helper: string;
}

const STAT_TILE_COLORS: Record<StatRowProps["iconColor"], string> = {
  blue: "bg-blue-100 text-blue-600",
  purple: "bg-purple-100 text-purple-600",
  teal: "bg-teal-100 text-teal-600",
  orange: "bg-orange-100 text-orange-600",
};

function StatRow({ icon, iconColor, label, value, helper }: StatRowProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${STAT_TILE_COLORS[iconColor]}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{helper}</p>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

interface QuickActionProps {
  href: string;
  icon: React.ReactNode;
  iconColor: "blue" | "purple" | "indigo" | "green" | "orange" | "pink";
  title: string;
  description: string;
}

const QUICK_ACTION_TILE: Record<QuickActionProps["iconColor"], string> = {
  blue: "bg-blue-100 text-blue-600 group-hover:bg-blue-200",
  purple: "bg-purple-100 text-purple-600 group-hover:bg-purple-200",
  indigo: "bg-indigo-100 text-indigo-600 group-hover:bg-indigo-200",
  green: "bg-green-100 text-green-600 group-hover:bg-green-200",
  orange: "bg-orange-100 text-orange-600 group-hover:bg-orange-200",
  pink: "bg-pink-100 text-pink-600 group-hover:bg-pink-200",
};

const QUICK_ACTION_BORDER: Record<QuickActionProps["iconColor"], string> = {
  blue: "hover:border-blue-200",
  purple: "hover:border-purple-200",
  indigo: "hover:border-indigo-200",
  green: "hover:border-green-200",
  orange: "hover:border-orange-200",
  pink: "hover:border-pink-200",
};

function QuickAction({
  href,
  icon,
  iconColor,
  title,
  description,
}: QuickActionProps) {
  return (
    <Link
      href={href}
      className={`group flex items-start gap-3 rounded-xl border border-gray-200/70 bg-white p-4 transition-all duration-200 hover:shadow-soft-md hover-lift ${QUICK_ACTION_BORDER[iconColor]}`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-lg shrink-0 transition-colors ${QUICK_ACTION_TILE[iconColor]}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">
          {description}
        </p>
      </div>
      <ArrowRight className="h-4 w-4 text-gray-400 shrink-0 group-hover:text-gray-600 group-hover:translate-x-0.5 transition-all" />
    </Link>
  );
}

export default function DashboardPage() {
  const { sessions, status } = useInterviewHistory();
  const { user } = useCurrentUser();
  const { items: jobDescriptions } = useJobDescriptions();

  const recentSessions = useMemo(() => sessions.slice(0, 5), [sessions]);
  const stats = useMemo(() => computeStats(sessions), [sessions]);
  const suggestion = useMemo(
    () =>
      getSuggestedNextSession(sessions, {
        hasJobDescriptions: jobDescriptions.length > 0,
        hasVoiceSessions: sessions.some((s) => s.practiceMode === "voice"),
      }),
    [sessions, jobDescriptions.length],
  );

  const inProgress = useMemo(
    () => sessions.find((session) => session.status === "in_progress") ?? null,
    [sessions],
  );

  const lastCompleted = useMemo(
    () =>
      sessions.find(
        (session) =>
          session.status === "completed" &&
          typeof session.averageScore === "number",
      ) ?? null,
    [sessions],
  );

  const isLoading = status === "loading";
  const firstName = useMemo(() => {
    const display = getDisplayName(user);
    return display.split(/\s+/)[0] ?? display;
  }, [user]);

  return (
    <div className="p-8 space-y-8 bg-linear-to-br from-gray-50 via-white to-gray-50/50">
      {/* Hero / greeting */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
          {getGreeting()}
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-gray-900">
          Welcome back, <span className="gradient-text">{firstName}</span>
        </h1>
        <p className="mt-1 text-gray-600 max-w-2xl">
          Pick a quick action below or continue where you left off.
        </p>
      </div>

      {/* Start practicing — the primary entry points (the rest of the nav lives
          in the sidebar, so we don't duplicate it here). */}
      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Start practicing
          </h2>
          <p className="text-sm text-gray-500">
            Pick a mode and jump straight in.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <QuickAction
            href="/simulate/setup?mode=text"
            icon={<MessageSquare className="h-5 w-5" />}
            iconColor="blue"
            title="Text interview"
            description="Type replies, get inline feedback in real time"
          />
          <QuickAction
            href="/simulate/setup?mode=voice"
            icon={<Mic className="h-5 w-5" />}
            iconColor="indigo"
            title="Voice interview"
            description="Speak out loud with a live interviewer"
          />
          <QuickAction
            href="/dashboard/drills"
            icon={<Dumbbell className="h-5 w-5" />}
            iconColor="orange"
            title="Quick drills"
            description="One question, instant model-answer feedback"
          />
        </div>
      </div>

      {/* Main column + right rail */}
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        {/* Main column: what to do next + history */}
        <div className="space-y-6 lg:col-span-2">
          {suggestion && (
            <Link href={suggestion.href} className="block group">
              <Card className="border border-blue-200/70 bg-linear-to-br from-blue-50 via-white to-indigo-50/50 hover:border-blue-300 hover:shadow-soft-md transition-all duration-200 hover-lift">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shrink-0">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-600">
                      Suggested next
                    </p>
                    <p className="mt-1 font-semibold text-gray-900 group-hover:text-blue-700">
                      {suggestion.title}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {suggestion.description}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      {suggestion.reason}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-blue-600 shrink-0" />
                </CardContent>
              </Card>
            </Link>
          )}

          {(inProgress || lastCompleted) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {inProgress && (
                <Link
                  href={
                    inProgress.practiceMode === "voice"
                      ? `/simulate/voice?session=${inProgress.id}`
                      : `/simulate/chat?session=${inProgress.id}`
                  }
                  className="group block"
                >
                  <Card className="h-full border border-orange-200/70 bg-linear-to-br from-orange-50 via-white to-amber-50/40 hover:border-orange-300 hover:shadow-soft-md transition-all duration-200 hover-lift">
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600 shrink-0">
                        <PlayCircle className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Badge
                          variant="outline"
                          className="border-orange-200 bg-orange-100/70 text-orange-700 mb-1"
                        >
                          In progress
                        </Badge>
                        <p className="font-semibold text-gray-900 truncate">
                          {inProgress.scenarioTitle ?? inProgress.scenarioValue}
                        </p>
                        <p className="text-sm text-gray-600 truncate">
                          with {inProgress.personaName}
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-orange-600 group-hover:translate-x-0.5 transition-all" />
                    </CardContent>
                  </Card>
                </Link>
              )}

              {lastCompleted && (
                <Link
                  href={`/simulate/report/${lastCompleted.id}`}
                  className="group block"
                >
                  <Card className="h-full border border-emerald-200/70 bg-linear-to-br from-emerald-50 via-white to-teal-50/40 hover:border-emerald-300 hover:shadow-soft-md transition-all duration-200 hover-lift">
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 shrink-0">
                        <TrendingUp className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Badge
                          variant="outline"
                          className="border-emerald-200 bg-emerald-100/70 text-emerald-700 mb-1"
                        >
                          Latest result · {lastCompleted.averageScore}%
                        </Badge>
                        <p className="font-semibold text-gray-900 truncate">
                          {lastCompleted.scenarioTitle ??
                            lastCompleted.scenarioValue}
                        </p>
                        <p className="text-sm text-gray-600 truncate">
                          Review feedback and scores
                        </p>
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                    </CardContent>
                  </Card>
                </Link>
              )}
            </div>
          )}

          {/* Recent sessions */}
          <Card className="border border-gray-200/80 shadow-soft">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Recent sessions</CardTitle>
                  <CardDescription>
                    Your latest practice conversations
                  </CardDescription>
                </div>
                <Link href="/dashboard/sessions">
                  <Button variant="outline" size="sm">
                    View all
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? (
                <SessionListSkeleton rows={3} />
              ) : recentSessions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <p className="mt-3 font-semibold text-gray-900">
                    No sessions yet
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Start your first interview to see it here.
                  </p>
                  <Link href="/simulate/setup" className="mt-4 inline-block">
                    <Button>Start practicing</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentSessions.map((session) => {
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
                        className="flex items-center gap-4 p-4 rounded-xl bg-gray-50/70 hover:bg-gray-100 transition-colors duration-150 group"
                      >
                        <div className="h-10 w-10 rounded-full bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                          {buildAvatar(session.personaName)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                            {session.scenarioTitle ?? session.scenarioValue}
                          </p>
                          <p className="text-sm text-gray-500 flex items-center gap-2">
                            <span>{session.personaName}</span>
                            <span>·</span>
                            <span>{formatRelativeDate(session.createdAt)}</span>
                            <span>·</span>
                            <span className="inline-flex items-center gap-1">
                              <ModeIcon className="h-3 w-3" />
                              {session.practiceMode === "voice"
                                ? "Voice"
                                : "Text"}
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
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right rail: at-a-glance stats + weekly goals */}
        <div className="space-y-6">
          <Card className="border border-gray-200/80 shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">At a glance</CardTitle>
            </CardHeader>
            <CardContent className="divide-y divide-gray-100 pt-0">
              <StatRow
                icon={<Target className="h-5 w-5" />}
                iconColor="blue"
                label="Total sessions"
                value={String(stats.total)}
                helper={
                  stats.total === 0 ? "Start your first" : "All-time"
                }
              />
              <StatRow
                icon={<TrendingUp className="h-5 w-5" />}
                iconColor="purple"
                label="Average score"
                value={
                  stats.averageScore === null ? "—" : `${stats.averageScore}%`
                }
                helper="Across scored sessions"
              />
              <StatRow
                icon={<Clock className="h-5 w-5" />}
                iconColor="teal"
                label="Practice time"
                value={
                  stats.totalMinutes >= 60
                    ? `${(stats.totalMinutes / 60).toFixed(1)}h`
                    : `${stats.totalMinutes}m`
                }
                helper="Time on interviews"
              />
            </CardContent>
          </Card>

          {!isLoading && (
            <div data-tour="goals">
              <GoalsCard sessions={sessions} />
            </div>
          )}
        </div>
      </div>

      <OnboardingDialog />
      <OnboardingTour />
    </div>
  );
}
