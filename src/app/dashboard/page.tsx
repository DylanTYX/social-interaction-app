"use client";

import { displayTitle } from "@/lib/session-organisation";
import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Mic, MessageSquare, PlayCircle } from "lucide-react";
import { useInterviewHistory } from "@/hooks/use-interview-history";
import { useCurrentUser, getDisplayName } from "@/hooks/use-current-user";
import { getSuggestedNextSession } from "@/lib/recommendations";
import { OnboardingDialog } from "@/components/dashboard/onboarding-dialog";
import { OnboardingTour } from "@/components/dashboard/onboarding-tour";
import { GoalsCard } from "@/components/dashboard/goals-card";
import {
  PageContainer,
  PageHeader,
  SectionHeader,
} from "@/components/dashboard/page-header";
import { StatTile } from "@/components/dashboard/stat-tile";
import { SessionListSkeleton } from "@/components/dashboard/page-skeletons";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { EmptyStateCard } from "@/components/dashboard/empty-state-card";
import { useJobDescriptions } from "@/hooks/use-job-descriptions";
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
 * One question per section now. Anything that answered a question another page
 * owns was deleted rather than rearranged.
 *
 *   1. What do I do now?      → one card, one primary button
 *   2. Am I improving?        → four numbers, linking to Analytics
 *   3. What have I done?      → five rows, linking to Sessions
 *   4. Am I being consistent? → streak and goal, which live nowhere else
 *
 * Every section has its heading outside its card, so the four read as one
 * system. See docs/DESIGN.md, "App screens".
 */
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
    <PageContainer>
      {/* The one page that greets rather than names itself: it is the page
          you land on, not one you choose from the sidebar. */}
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Pick up where you left off, or start something new."
      />

      {/* 1. What do I do now?
          The one card on this page with a tinted ground, because it holds the
          one action the page exists for. The recommendation is the label on
          that action rather than a separate surface competing with it. */}
      <Card className="border-primary-border bg-primary-subtle py-5">
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900">
              {resumeHref
                ? "You have an interview in progress"
                : (suggestion?.title ?? "Start a practice interview")}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {resumeHref
                ? `${inProgress ? displayTitle(inProgress) : ""} · ${inProgress?.personaName}`
                : (suggestion?.reason ??
                  "Set up a round, pick an interviewer, and go.")}
            </p>
          </div>
          <Button asChild size="lg">
            <Link href={resumeHref ?? suggestion?.href ?? "/simulate/setup"}>
              {resumeHref ? (
                <>
                  <PlayCircle />
                  Resume interview
                </>
              ) : (
                <>
                  Start interview
                  <ArrowRight />
                </>
              )}
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* 2. Am I improving?
          From `computeSessionStats`, the same function Analytics uses. The
          section links to the page that owns these numbers. */}
      <section className="space-y-4">
        <SectionHeader
          title="Your progress"
          link={{ label: "View analytics", href: "/dashboard/analytics" }}
        />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile
            label="Sessions"
            value={hasError ? "—" : String(stats.total)}
            caption={hasError ? "Couldn't load" : `${stats.completed} scored`}
          />
          <StatTile
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
          <StatTile
            label="Practice time"
            value={hasError ? "—" : formatPracticeMinutes(stats.totalMinutes)}
            caption={
              hasError ? "Couldn't load" : describeStatsWindow(stats.total)
            }
          />
          <StatTile
            label="Voice / text"
            value={hasError ? "—" : `${stats.voiceCount}/${stats.textCount}`}
            caption={hasError ? "Couldn't load" : "Sessions by mode"}
          />
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* 3. What have I done? */}
        <section className="space-y-4 lg:col-span-2">
          <SectionHeader
            title="Recent sessions"
            link={{ label: "View all", href: "/dashboard/sessions" }}
          />
          {hasError ? (
            <ErrorStateCard
              title="Couldn't load your sessions"
              description={error ?? "Something went wrong."}
              onRetry={refresh}
            />
          ) : isLoading ? (
            // Five rows in the same card the rows render in, because five will
            // render there. It was three, so the list grew when the fetch settled.
            <Card className="gap-0 py-2">
              <SessionListSkeleton rows={5} />
            </Card>
          ) : recentSessions.length === 0 ? (
            <EmptyStateCard
              title="No sessions yet"
              description="Your first interview will show up here."
            />
          ) : (
            <Card className="gap-0 py-2">
              <div className={cn("divide-y divide-slate-100", CONTENT_ENTER)}>
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
                        "group flex items-center gap-4 px-5 py-3.5 transition-colors duration-150 hover:bg-slate-50",
                        ROW_ENTER,
                      )}
                    >
                      <InitialsAvatar name={session.personaName} />

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-slate-900 transition-colors group-hover:text-primary">
                          {displayTitle(session)}
                        </p>
                        <p className="flex items-center gap-2 text-sm text-slate-500">
                          <span className="truncate">
                            {session.personaName}
                          </span>
                          <span aria-hidden>·</span>
                          <span className="shrink-0">
                            {formatRelativeDate(session.createdAt)}
                          </span>
                          <span aria-hidden>·</span>
                          <span className="inline-flex shrink-0 items-center gap-1">
                            <ModeIcon className="h-3 w-3" aria-hidden />
                            {session.practiceMode === "voice"
                              ? "Voice"
                              : "Text"}
                          </span>
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="font-display text-xl leading-none font-bold text-navy tabular-nums">
                          {session.averageScore === null
                            ? "—"
                            : `${session.averageScore}%`}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">score</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </Card>
          )}
        </section>

        {/* 4. Am I practising enough?
            Sessions this week against the goal you set, by day. */}
        <section className="space-y-4">
          <SectionHeader title="This week" />
          {!isLoading && !hasError && <GoalsCard sessions={sessions} />}
        </section>
      </div>

      <OnboardingDialog />
      <OnboardingTour />
    </PageContainer>
  );
}
