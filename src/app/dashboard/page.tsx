"use client";

import { displayTitle } from "@/lib/session-organisation";
import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  Clock,
  Target,
  Award,
  Mic,
  MessageSquare,
  ArrowRight,
  PlayCircle,
} from "lucide-react";
import { useInterviewHistory } from "@/hooks/use-interview-history";
import { useCurrentUser, getDisplayName } from "@/hooks/use-current-user";
import { getSuggestedNextSession } from "@/lib/recommendations";
import { OnboardingDialog } from "@/components/dashboard/onboarding-dialog";
import { OnboardingTour } from "@/components/dashboard/onboarding-tour";
import { GoalsCard } from "@/components/dashboard/goals-card";
import { PageHeader } from "@/components/dashboard/page-header";
import { SessionListSkeleton } from "@/components/dashboard/page-skeletons";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { useJobDescriptions } from "@/hooks/use-job-descriptions";
import { TILE_COLORS, type TileColor } from "@/lib/tile-colors";
import { formatRelativeDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CONTENT_ENTER, ROW_ENTER, staggerDelay } from "@/lib/motion";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import {
  computeSessionStats,
  describeStatsWindow,
  formatAverageScore,
  formatPracticeMinutes,
  STATS_WINDOW,
} from "@/lib/session-stats";

/**
 * The dashboard home.
 *
 * This was nine card surfaces, seventeen counting nested panels, and six accent
 * colours at once — and the real problem was not arrangement. **Four sections
 * were answering the same question**, so none of them was allowed to be the
 * answer:
 *
 *   - "Suggested next", "In progress" and a row of "Recent sessions" could all
 *     render the *same in-progress session*, in three different colours.
 *   - "Latest result" was normally row 1 of "Recent sessions", 250px away.
 *   - Three "Start practicing" tiles restated sidebar links, under a comment
 *     claiming they didn't.
 *   - "At a glance" duplicated all three Analytics tiles, computed by a second
 *     function that had already drifted on rounding and on printing zero.
 *
 * And with all that, there was **no primary call to action**: the only `Button`
 * in the populated state was `variant="outline" size="sm"` — "View all".
 *
 * One question per section now. Anything that answered a question another page
 * owns was deleted rather than rearranged.
 *
 *   1. What do I do now?     → one card, one primary button
 *   2. Am I improving?       → four metrics, linking to Analytics
 *   3. What have I done?     → five rows, linking to Sessions
 *   4. Am I being consistent? → streak and goal, which live nowhere else
 */

function MetricTile({
  icon,
  color,
  label,
  value,
  caption,
}: {
  icon: React.ReactNode;
  color: TileColor;
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-7 w-7 items-center justify-center rounded-lg ${TILE_COLORS[color]}`}
            aria-hidden
          >
            {icon}
          </span>
          <span className="text-xs font-medium text-muted-foreground">
            {label}
          </span>
        </div>
        <p className="text-2xl font-bold tabular-nums text-foreground">
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{caption}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { sessions, status, error, refresh } =
    useInterviewHistory(STATS_WINDOW);
  const { user } = useCurrentUser();
  // Fetches the whole library to derive one boolean, which is wasteful. Kept
  // deliberately: dropping it would silently remove the JD-aware branch of the
  // recommendation. Fixing it properly means a count endpoint.
  const { items: jobDescriptions, status: jobDescriptionStatus } =
    useJobDescriptions();

  const recentSessions = useMemo(() => sessions.slice(0, 5), [sessions]);
  const stats = useMemo(() => computeSessionStats(sessions), [sessions]);

  const inProgress = useMemo(
    () => sessions.find((session) => session.status === "in_progress") ?? null,
    [sessions],
  );

  const suggestion = useMemo(
    () =>
      getSuggestedNextSession(sessions, {
        // `undefined` when we do not know. The hook's error was discarded
        // here, so a failed or 401 load was indistinguishable from an empty
        // library — and the recommender silently dropped its JD-aware branch
        // for a user who does have one.
        hasJobDescriptions:
          jobDescriptionStatus === "ready"
            ? jobDescriptions.length > 0
            : undefined,
        hasVoiceSessions: sessions.some((s) => s.practiceMode === "voice"),
      }),
    [sessions, jobDescriptions.length, jobDescriptionStatus],
  );

  const isLoading = status === "loading";
  // A failed load must not be presented as "you have no data". Every count
  // below is meaningless when this is true.
  const hasError = status === "error";
  const firstName = useMemo(() => {
    const display = getDisplayName(user);
    return display.split(/\s+/)[0] ?? display;
  }, [user]);

  // Resuming beats starting: an abandoned session is the one thing on this page
  // with a deadline attached to it.
  const resumeHref = inProgress
    ? inProgress.practiceMode === "voice"
      ? `/simulate/voice?session=${inProgress.id}`
      : `/simulate/chat?session=${inProgress.id}`
    : null;

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        eyebrow="Home"
        title={`Welcome back, ${firstName}`}
        description="Pick up where you left off, or start something new."
        icon={<Target className="h-6 w-6" />}
        iconColor="blue"
      />

      {/* 1. What do I do now?
          This one card replaces five: the three mode tiles, the "Suggested
          next" card and the "In progress" card. The recommendation is now the
          *label on the action* rather than a separate surface competing with
          it, and an in-progress session appears here or in the list below —
          never in three places at once.

          The mode tiles are gone because the wizard's first step now asks that
          question properly, with the consequences attached: voice needs a
          microphone and has no code editor. A dashboard tile skipped all that. */}
      <Card className="shadow-soft">
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">
              {resumeHref
                ? "You have an interview in progress"
                : (suggestion?.title ?? "Start a practice interview")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {resumeHref
                ? `${inProgress ? displayTitle(inProgress) : ""} · ${inProgress?.personaName}`
                : (suggestion?.reason ??
                  "Set up a round, pick an interviewer, and go.")}
            </p>
          </div>
          <Button asChild size="lg" className="gap-2">
            <Link href={resumeHref ?? suggestion?.href ?? "/simulate/setup"}>
              {resumeHref ? (
                <>
                  <PlayCircle className="h-4 w-4" />
                  Resume interview
                </>
              ) : (
                <>
                  Start interview
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* 2. Am I improving?
          These four numbers come from `computeSessionStats`, the same function
          Analytics uses — they used to be computed twice, differently. The
          section links to the page that owns them instead of pretending to be
          that page. */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">
            Your progress
          </h2>
          <Button variant="ghost" size="sm" asChild className="gap-1">
            <Link href="/dashboard/analytics">
              View analytics
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <MetricTile
            icon={<Target className="h-4 w-4" />}
            color="blue"
            label="Sessions"
            value={hasError ? "—" : String(stats.total)}
            caption={hasError ? "Couldn't load" : `${stats.completed} scored`}
          />
          <MetricTile
            icon={<TrendingUp className="h-4 w-4" />}
            color="purple"
            label="Average score"
            value={hasError ? "—" : formatAverageScore(stats.averageScore)}
            caption={
              hasError
                ? "Couldn't load"
                : stats.bestScore === null
                  ? "No scores yet"
                  : `Best ${Math.round(stats.bestScore)}%`
            }
          />
          <MetricTile
            icon={<Clock className="h-4 w-4" />}
            color="teal"
            label="Practice time"
            value={hasError ? "—" : formatPracticeMinutes(stats.totalMinutes)}
            caption={
              hasError ? "Couldn't load" : describeStatsWindow(stats.total)
            }
          />
          <MetricTile
            icon={<Award className="h-4 w-4" />}
            color="orange"
            label="Mode mix"
            value={hasError ? "—" : `${stats.voiceCount}/${stats.textCount}`}
            caption={hasError ? "Couldn't load" : "Voice / text"}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 3. What have I done? */}
        <section className="space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              Recent sessions
            </h2>
            <Button variant="ghost" size="sm" asChild className="gap-1">
              <Link href="/dashboard/sessions">
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
          <Card className="shadow-soft">
            <CardContent>
              {hasError ? (
                <ErrorStateCard
                  title="Couldn't load your sessions"
                  description={error ?? "Something went wrong."}
                  onRetry={refresh}
                />
              ) : isLoading ? (
                // Five rows, because five will render. It was three, so the
                // card grew every time the fetch settled.
                <SessionListSkeleton rows={5} />
              ) : recentSessions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <p className="font-medium text-foreground">No sessions yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Your first interview will show up here.
                  </p>
                </div>
              ) : (
                <div className={cn("space-y-2", CONTENT_ENTER)}>
                  {recentSessions.map((session, index) => {
                    const ModeIcon =
                      session.practiceMode === "voice" ? Mic : MessageSquare;
                    return (
                      <Link
                        key={session.id}
                        style={staggerDelay(index)}
                        href={
                          session.status === "in_progress"
                            ? session.practiceMode === "voice"
                              ? `/simulate/voice?session=${session.id}`
                              : `/simulate/chat?session=${session.id}`
                            : `/simulate/report/${session.id}`
                        }
                        className={cn(
                          "group flex items-center gap-4 rounded-xl p-4 transition-colors duration-150 hover:bg-accent",
                          ROW_ENTER,
                        )}
                      >
                        <InitialsAvatar name={session.personaName} />

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground transition-colors group-hover:text-primary-emphasis">
                            {displayTitle(session)}
                          </p>
                          <p className="flex items-center gap-2 text-sm text-muted-foreground">
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

                        <div className="shrink-0 text-right">
                          <div className="text-lg font-bold tabular-nums text-primary">
                            {session.averageScore === null
                              ? "—"
                              : `${session.averageScore}%`}
                          </div>
                          <p className="text-xs text-muted-foreground">score</p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* 4. Am I being consistent?
            The streak, the weekly goal and the badges are the only numbers on
            this page that exist nowhere else, which is exactly why this section
            survived the cut. */}
        {/* `GoalsCard` supplies its own "Your week" heading, so this section
            deliberately has none — two would be a duplicate, and the other
            three sections need their heading because their card does not
            carry one. */}
        <section>
          {!isLoading && !hasError && <GoalsCard sessions={sessions} />}
        </section>
      </div>

      <OnboardingDialog />
      <OnboardingTour />
    </div>
  );
}
