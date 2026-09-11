"use client";

import { describeDifficulty } from "@/lib/interview-difficulty";
import { readJson } from "@/lib/api/fetch-json";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Code2,
  FileText,
  Gauge,
  Lightbulb,
  Link2,
  ListChecks,
  MessageSquare,
  MessagesSquare,
  Mic,
  MoreHorizontal,
  Pin,
  PinOff,
  Printer,
  RotateCcw,
  Sparkles,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CONTENT_ENTER } from "@/lib/motion";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  createDefaultResumeConfig,
  saveInterviewLaunch,
  updateInterviewSetup,
} from "@/lib/interview-setup";
import type { PersonaConfig } from "@/lib/persona-engine";
import {
  readCompetencyCoverage,
  readLaunchMeta,
  readLoopProgress,
  withoutDeletedAttachments,
  type SessionLaunchMeta,
} from "@/lib/session-launch-meta";
import {
  getCurrentRound,
  getNextRoundLoop,
  ROUND_TYPE_LABELS,
  type InterviewRoundType,
} from "@/lib/interview-rounds";
import { isTechnicalRound } from "@/lib/round-types";
import { parseCodeAnswer } from "@/lib/code-answer";
import { suggestedBreakMinutes } from "@/lib/interview-progress";
import { ScoreComparison } from "@/components/report/score-comparison";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InsightCard } from "@/components/report/insight-card";
import { ScoreReveal } from "@/components/report/score-reveal";
import { SessionNotesCard } from "@/components/report/session-notes-card";
import { EditableTitle } from "@/components/sessions/editable-title";
import {
  communicationDetail,
  durationDetail,
  predictionDetail,
  starDetail,
  technicalDetail,
} from "@/lib/report-insights";
import { patchSessionRequest } from "@/lib/session-actions";
import { TILE_COLORS } from "@/lib/tile-colors";
import {
  buildRadarAxes,
  DimensionRadar,
} from "@/components/report/dimension-radar";
import { TurnScore, toTurnFeedback } from "@/components/report/turn-score";
import { CompetencyCoverageCard } from "@/components/report/competency-coverage-card";
import { CoachingResult } from "@/components/coach/coaching-result";
import type { SuggestedAnswerResult } from "@/lib/coach-contract";
import type { AnalysisResult } from "@/lib/response-analyzer";
import { parseCoverage } from "@/lib/competencies";

interface MessageRecord {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  turnIndex: number;
  createdAt: string;
}

interface SessionRecord {
  id: string;
  practiceMode: "text" | "voice";
  scenarioTitle: string | null;
  scenarioValue: string;
  personaName: string;
  /** Both already returned by `/report`; declared so the page can reuse them. */
  personaConfig: PersonaConfig;
  launchMeta: SessionLaunchMeta | null;
  /**
   * The live attachment columns. Declared so "Practise again" can tell a
   * document that is still there from one deleted since — the snapshot in
   * `launchMeta` cannot, and pre-filling the wizard with a dead reference
   * blocks Continue on a document the user never chose here.
   */
  jobDescriptionId: string | null;
  resumeId: string | null;
  status: "in_progress" | "completed" | "abandoned";
  summary: string | null;
  turnCount: number;
  averageScore: number | null;
  durationMinutes: number | null;
  metrics: Record<string, unknown> | null;
  startedAt: string;
  endedAt: string | null;
  /** Organisation fields (migration 0018); absent on an older database. */
  title?: string | null;
  pinned?: boolean;
  notes?: string | null;
}

/** The scored-answer rows as they arrive over the wire. */
interface TurnAnalysisRecord {
  turnIndex: number;
  overallScore: number | null;
  analysis: Record<string, unknown> | null;
}

interface ReportPayload {
  session: SessionRecord;
  messages: MessageRecord[];
  /**
   * One row per scored answer. The API has always returned this
   * (`report/route.ts`), and this interface never declared it — so it was
   * fetched, sent over the wire and discarded on every report, leaving the user
   * with one aggregate number and no way to see which answer cost them.
   */
  turnAnalyses: TurnAnalysisRecord[];
  jobDescription: {
    id: string;
    title: string;
    roleTitle: string | null;
    company: string | null;
  } | null;
}

function pickNumber(
  metrics: Record<string, unknown> | null,
  key: string,
): number | null {
  if (!metrics) return null;
  const value = metrics[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = Math.round(minutes - hours * 60);
  return remaining === 0 ? `${hours} hr` : `${hours} hr ${remaining} min`;
}

function formatScore(score: number | null): string {
  return score === null ? "—" : `${Math.round(score)}%`;
}

function formatReportDate(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  return new Date(ts).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "";
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  return new Date(ts).toLocaleString();
}

export default function SessionReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [data, setData] = useState<ReportPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [isStartingNextRound, setIsStartingNextRound] = useState(false);
  const [nextRoundError, setNextRoundError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const response = await fetch(`/api/sessions/${id}/report`, {
          cache: "no-store",
        });
        const payload = await readJson<ReportPayload>(response);
        if (cancelled) return;
        setData(payload);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Failed to load session.",
        );
        setStatus("error");
      }
    };

    queueMicrotask(() => {
      if (!cancelled) {
        void run();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-8">
        <div className="mx-auto max-w-5xl space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-soft-md">
          <h2 className="text-xl font-semibold text-slate-900">
            We couldn&apos;t load that session
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {error ?? "It may have been deleted or you may not have access."}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Link href="/dashboard">
              <Button variant="outline">Back to dashboard</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { session, messages, jobDescription } = data;
  const launch = readLaunchMeta(session);
  const loop = launch?.interviewLoop;
  const nextLoop = loop?.enabled ? getNextRoundLoop(loop) : null;
  const nextRound = nextLoop ? getCurrentRound(nextLoop) : null;
  // Not gated on `enabled`: a targeted single round has a real type, and
  // gating here made the coach treat every answer as behavioural/STAR.
  const currentRound = loop ? getCurrentRound(loop) : null;
  const loopId = readLoopProgress(session)?.loopId ?? null;
  const coverage = parseCoverage(readCompetencyCoverage(session));
  const ModeIcon = session.practiceMode === "voice" ? Mic : MessageSquare;
  const overallScore = pickNumber(session.metrics, "averageOverallScore");
  const confidenceScore = pickNumber(session.metrics, "averageConfidenceScore");
  const starScore = pickNumber(session.metrics, "averageSTARScore");
  const usesTechnicalRubric = isTechnicalRound(currentRound?.type);
  const analyses = (data.turnAnalyses ?? []).flatMap((entry) =>
    entry.analysis ? [entry.analysis] : [],
  );
  const scoredAnswers = (data.turnAnalyses ?? []).length;
  const displayedScore = overallScore ?? session.averageScore;

  /** Reflect an organisation change the server has accepted. */
  const updateReportSession = (patch: Partial<SessionRecord>) =>
    setData((current) =>
      current ? { ...current, session: { ...current.session, ...patch } } : current,
    );

  const handleTogglePin = async () => {
    const pinned = session.pinned !== true;
    updateReportSession({ pinned });
    try {
      await patchSessionRequest(session.id, { pinned });
      toast.success(pinned ? "Pinned to the top of your sessions" : "Unpinned");
    } catch (err) {
      updateReportSession({ pinned: !pinned });
      toast.error(err instanceof Error ? err.message : "Couldn't update this session.");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Report link copied to clipboard");
    } catch {
      toast.error("Couldn't copy the link");
    }
  };

  const handleStartNextRound = async () => {
    if (!nextRound) return;
    setIsStartingNextRound(true);
    setNextRoundError(null);
    try {
      const response = await fetch(`/api/sessions/${id}/next-round`, {
        method: "POST",
      });
      const payload = await readJson<{
        session: {
          id: string;
          practiceMode: "text" | "voice";
          scenarioValue: string;
          personaConfig: PersonaConfig;
        };
        launchMeta: SessionLaunchMeta;
      }>(response);
      saveInterviewLaunch({
        scenarioValue: payload.session.scenarioValue,
        customScenarioBrief: payload.launchMeta.customScenarioBrief,
        streamResponses: payload.launchMeta.streamResponses,
        liveCoachingEnabled: payload.launchMeta.liveCoachingEnabled,
        personaConfig: payload.session.personaConfig,
        personaLibraryId: payload.launchMeta.personaLibraryId,
        practiceMode: payload.session.practiceMode,
        interviewLoop: payload.launchMeta.interviewLoop,
        voiceConfig: payload.launchMeta.voiceConfig,
        jobDescription: payload.launchMeta.jobDescription,
        resume: payload.launchMeta.resume ?? createDefaultResumeConfig(),
        sessionId: payload.session.id,
      });
      router.push(
        `/simulate/${payload.session.practiceMode}?session=${payload.session.id}`,
      );
    } catch (err) {
      setNextRoundError(
        err instanceof Error ? err.message : "Could not start the next round.",
      );
    } finally {
      setIsStartingNextRound(false);
    }
  };

  /**
   * Run this interview again, without rebuilding it by hand.
   *
   * The report used to end at the transcript: its only forward action was
   * "Start next round", which exists only for loops. Finish a single-round
   * practice and there was nothing to do next — no way to repeat the setup, and
   * the dashboard's "your weakest scenario is X" card linked to a *blank*
   * wizard, so it identified the right thing to practise and then discarded it.
   *
   * This pre-fills the wizard rather than launching straight in: the user
   * usually wants to change one thing — a harder persona, a longer round — and
   * the review step is where they can.
   */
  const handlePractiseAgain = () => {
    if (!data) return;
    const { session: previous } = data;
    const launch = previous.launchMeta;

    updateInterviewSetup({
      scenarioValue: previous.scenarioValue,
      customScenarioBrief: launch?.customScenarioBrief ?? "",
      practiceMode: previous.practiceMode,
      personaConfig: previous.personaConfig,
      personaLibraryId: launch?.personaLibraryId,
      ...(launch?.interviewLoop ? { interviewLoop: launch.interviewLoop } : {}),
      ...(launch?.voiceConfig ? { voiceConfig: launch.voiceConfig } : {}),
      ...(launch ? withoutDeletedAttachments(launch, previous) : {}),
    });

    router.push(`/simulate/setup?mode=${previous.practiceMode}`);
  };

  return (
    // `AppShell` owns the scroll container and background now. The back arrow
    // is gone with it — the sidebar is the way out, which is the whole reason
    // this page needed chrome: you land here after every session and had one
    // exit.
    <div className={cn("mx-auto max-w-5xl space-y-6 p-8", CONTENT_ENTER)}>
      {/*
        What the session was on the left, what to do next on the right. The
        report is for reading: tags and the rest of the organising live on the
        Sessions page, so the header carries a title you can click to rename,
        one line of facts, and the job it was practice for. "Practise again" is
        the one thing most people do next, so it is the only button; pinning and
        sharing sit behind one menu.
      */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Session report
          </p>
          <EditableTitle
            sessionId={session.id}
            title={session.title ?? null}
            generatedTitle={session.scenarioTitle ?? session.scenarioValue}
            onRenamed={(title) => updateReportSession({ title })}
          />
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1">
              <ModeIcon className="h-3.5 w-3.5" aria-hidden />
              {session.practiceMode === "voice" ? "Voice" : "Text"}
            </span>
            <span aria-hidden>·</span>
            <span>{session.personaName}</span>
            <span aria-hidden>·</span>
            <span>
              {scoredAnswers} scored answer{scoredAnswers === 1 ? "" : "s"}
            </span>
            <span aria-hidden>·</span>
            <span>{formatReportDate(session.startedAt)}</span>
          </p>
          {jobDescription && (
            <p
              className="flex min-w-0 items-center gap-1.5 text-sm text-slate-600"
              title={jobDescription.title}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              {/* Role at company when both are known, which is what the
                  interviewer was actually told. */}
              <span className="truncate">
                {[jobDescription.roleTitle, jobDescription.company]
                  .filter(Boolean)
                  .join(" at ") || jobDescription.title}
              </span>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 print:hidden">
          <Button className="gap-1.5" onClick={handlePractiseAgain}>
            <RotateCcw className="h-4 w-4" />
            Practise again
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void handleTogglePin()}>
                {session.pinned ? (
                  <PinOff className="h-4 w-4" />
                ) : (
                  <Pin className="h-4 w-4" />
                )}
                {session.pinned ? "Unpin from your sessions" : "Pin to top of your sessions"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void handleCopyLink()}>
                <Link2 className="h-4 w-4" />
                Copy link
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => window.print()}>
                <Printer className="h-4 w-4" />
                Download PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ScoreReveal sessionId={session.id} actualScore={displayedScore}>
        {(prediction, justRevealed) => (
          <div
            className={cn(
              "space-y-6",
              justRevealed &&
                "animate-in fade-in-0 slide-in-from-bottom-2 duration-500 ease-soft",
            )}
          >
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Full width, so the score has room for what qualifies it — the
                  change since last time, your prediction, and how hard this
                  interviewer was — without squeezing the three cards below.
                  Card, tile and type follow the analytics page's stat cards. */}
              <Card className="shadow-soft sm:col-span-3">
                <CardContent className="p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-slate-600">
                      Overall score
                    </p>
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        TILE_COLORS.blue,
                      )}
                    >
                      <Gauge className="h-5 w-5" aria-hidden />
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-1">
                      <p className="text-4xl font-bold tabular-nums text-slate-900">
                        {formatScore(displayedScore)}
                      </p>
                      <ScoreComparison
                        sessionId={session.id}
                        currentScore={displayedScore}
                        currentStartedAt={session.startedAt}
                      />
                    </div>
                    <div className="space-y-1.5 sm:max-w-md sm:border-l sm:border-slate-200 sm:pl-5">
                      {prediction?.kind === "guessed" && displayedScore !== null && (
                        <p className="text-sm font-medium text-slate-700">
                          {predictionDetail(prediction.guess, displayedScore)}
                        </p>
                      )}
                      {/* The rubric is persona-blind, but the *questions* are not:
                          difficulty folds in (strictness - warmth), so easier
                          questions get better answers. Two scores from different
                          interviewers are not the same achievement. */}
                      {(() => {
                        const difficulty = describeDifficulty(
                          session.personaConfig?.strictness,
                          session.personaConfig?.warmth,
                        );
                        return (
                          <p className="text-xs leading-relaxed text-slate-500">
                            <span className="font-medium text-slate-600">
                              {difficulty.label}.
                            </span>{" "}
                            {difficulty.note}
                          </p>
                        );
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <InsightCard
                color="teal"
                icon={MessagesSquare}
                label="Communication"
                value={
                  confidenceScore === null
                    ? "—"
                    : `${Math.round(confidenceScore * 10)}%`
                }
                detail={communicationDetail(confidenceScore, analyses)}
              />
              <InsightCard
                color={usesTechnicalRubric ? "indigo" : "purple"}
                icon={usesTechnicalRubric ? Code2 : ListChecks}
                label={usesTechnicalRubric ? "Technical rubric" : "STAR average"}
                value={starScore === null ? "—" : `${Math.round(starScore * 10)}%`}
                detail={
                  usesTechnicalRubric
                    ? technicalDetail(analyses)
                    : starDetail(analyses)
                }
              />
              <InsightCard
                color="orange"
                icon={Timer}
                label="Duration"
                value={formatDuration(session.durationMinutes)}
                detail={durationDetail(session.durationMinutes, scoredAnswers)}
              />
            </div>

            {/* The same marks with their shape kept: which dimension earned
                them. Axes follow the analyzer's two rubric families; absent for
                sessions with no scored turns. */}
            {(() => {
              const axes = buildRadarAxes(
                (data.turnAnalyses ?? []).flatMap((entry) =>
                  entry.analysis
                    ? [entry.analysis as Partial<AnalysisResult>]
                    : [],
                ),
                usesTechnicalRubric,
              );
              if (!axes) return null;
              return (
                <Card className="border-slate-200/80 bg-white">
                  <CardHeader>
                    <CardTitle className="text-base">Dimension profile</CardTitle>
                    <CardDescription>
                      {usesTechnicalRubric
                        ? "Averaged across this round's scored answers, on the technical rubric."
                        : "Averaged across this round's scored answers, on the STAR rubric."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <DimensionRadar axes={axes} />
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        )}
      </ScoreReveal>

      {loop?.enabled && currentRound && (
        <Card className="border-primary-border/80 bg-primary-subtle/40">
          <CardHeader>
            <CardTitle className="text-base">
              Round {loop.currentRoundIndex + 1} of {loop.rounds.length}{" "}
              complete
            </CardTitle>
            <CardDescription>
              {currentRound.title} · {ROUND_TYPE_LABELS[currentRound.type]}
            </CardDescription>
          </CardHeader>
          {nextRound ? (
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="text-sm text-slate-700">
                Next up: <strong>{nextRound.title}</strong>
                {suggestedBreakMinutes(currentRound.durationMinutes) > 0
                  ? ` · suggested ${suggestedBreakMinutes(currentRound.durationMinutes)} min break`
                  : ""}
              </div>
              <Button
                onClick={() => void handleStartNextRound()}
                disabled={isStartingNextRound}
                className="gap-2"
              >
                <Sparkles className="h-4 w-4" />
                {isStartingNextRound ? "Starting..." : "Start next round"}
              </Button>
              <p className="w-full text-xs text-slate-500">
                Your next interviewer will see a short summary of this round.
              </p>
              {nextRoundError && (
                <p className="w-full text-sm text-destructive" role="alert">
                  {nextRoundError}
                </p>
              )}
            </CardContent>
          ) : (
            <CardContent className="space-y-3">
              <p className="text-sm text-slate-700">
                You finished the full loop. Nice work.
              </p>
              {loopId && (
                <Link href={`/simulate/loop/${loopId}`}>
                  <Button variant="outline" className="gap-2">
                    <Sparkles className="h-4 w-4" />
                    View combined loop report
                  </Button>
                </Link>
              )}
            </CardContent>
          )}
          {nextRound && loopId && (
            <CardContent className="pt-0">
              <Link
                href={`/simulate/loop/${loopId}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                See how you are tracking across rounds so far →
              </Link>
            </CardContent>
          )}
        </Card>
      )}

      <CompetencyCoverageCard coverage={coverage} />

      {session.summary && (
        <Card className="border-slate-200/80 bg-white">
          <CardHeader>
            <CardTitle className="text-base">Session summary</CardTitle>
            <CardDescription>
              Auto-generated rolling summary used during the interview.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
              {session.summary}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-200/80 bg-white">
        <CardHeader>
          <CardTitle className="text-base">Transcript</CardTitle>
          <CardDescription>
            {messages.length} messages · {formatTimestamp(session.startedAt)}
            {session.endedAt ? ` → ${formatTimestamp(session.endedAt)}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages.length === 0 ? (
            <p className="text-sm text-slate-500">
              No messages were recorded for this session.
            </p>
          ) : (
            (() => {
              const visible = messages.filter(
                (message) => message.role !== "system",
              );
              // Keyed by turn index, which is what `interview_turn_analyses`
              // records against and what the message carries.
              const analysisByTurn = new Map(
                (data.turnAnalyses ?? []).map((entry) => [
                  entry.turnIndex,
                  entry,
                ]),
              );
              let lastQuestion = "";
              return visible.map((message) => {
                const isUser = message.role === "user";
                const questionForTurn = lastQuestion;
                if (!isUser) {
                  lastQuestion = message.content;
                }
                return (
                  <div
                    key={message.id}
                    className={`flex flex-col ${
                      isUser ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`max-w-2xl rounded-2xl border px-4 py-3 ${
                        isUser
                          ? "border-primary-border bg-primary-subtle text-slate-900"
                          : "border-slate-200 bg-white text-slate-800"
                      }`}
                    >
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                        {isUser ? "You" : session.personaName}
                      </p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
                        {message.content}
                      </p>
                    </div>
                    {isUser &&
                      (() => {
                        const scored = analysisByTurn.get(message.turnIndex);
                        if (!scored) return null;
                        return (
                          <TurnScore
                            feedback={toTurnFeedback(
                              scored.analysis,
                              scored.overallScore,
                            )}
                          />
                        );
                      })()}
                    {isUser && questionForTurn && (
                      <TurnCoaching
                        question={questionForTurn}
                        answer={message.content}
                        roundType={currentRound?.type}
                        practiceMode={session.practiceMode}
                        sessionId={id}
                        turnIndex={message.turnIndex}
                      />
                    )}
                  </div>
                );
              });
            })()
          )}
        </CardContent>
      </Card>

      <SessionNotesCard
        sessionId={session.id}
        notes={session.notes ?? null}
        onSaved={(notes) => updateReportSession({ notes })}
      />
    </div>
  );
}

/**
 * On-demand coaching for a single answer in the report transcript. Kept lazy
 * (only fetches when the user asks) so we never spend tokens on turns the user
 * doesn't care to review.
 */
function TurnCoaching({
  question,
  answer,
  roundType,
  practiceMode,
  sessionId,
  turnIndex,
}: {
  question: string;
  answer: string;
  roundType: InterviewRoundType | undefined;
  /**
   * Decides how this answer gets read. A voice turn is a speech-to-text
   * transcript, so without this the coach spends tips on absent punctuation;
   * a fenced answer is code whichever mode produced it, and the editor is
   * reachable from a voice round too, so the fence is checked first.
   */
  practiceMode: "text" | "voice";
  /**
   * Both identify the turn so the server can cache the result. Without them
   * the answer was regenerated at full price on every reload — the state below
   * only survives while this component stays mounted.
   */
  sessionId: string;
  turnIndex: number;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestedAnswerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (result || loading) return;

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/coach/suggested-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          answer,
          roundType,
          answerMode: parseCodeAnswer(answer)
            ? "code"
            : practiceMode === "voice"
              ? "speech"
              : "text",
          sessionId,
          turnIndex,
        }),
      });
      setResult(await readJson<SuggestedAnswerResult>(response));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate a stronger answer.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-1.5 w-full max-w-2xl">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => void handleToggle()}
        className="h-7 gap-1.5 text-xs text-warning-emphasis hover:bg-warning-subtle hover:text-warning-emphasis"
      >
        <Lightbulb className="h-3.5 w-3.5" />
        {open ? "Hide coaching" : "See a stronger answer"}
      </Button>

      {open && (
        // White, not the amber wash it used to be. `CoachingResult` now colours
        // its own panels, and an amber rewrite panel on an amber ground was the
        // one place that stopped reading as a panel at all. The amber border
        // keeps the coaching identity the disclosure button sets up.
        <div className="mt-2 space-y-3 rounded-xl border border-warning-border bg-white p-4">
          {loading && (
            <p className="flex items-center gap-2 text-xs text-warning-emphasis">
              <span className="h-2 w-2 animate-breathe rounded-full bg-warning" />
              Coaching this answer…
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          {/* No `originalAnswer`: the answer bubble is rendered a few rows above
              this in the transcript, so the before/after pair would duplicate
              it. Without it the tips take the full width and the rewrite and
              the suggested answer pair off beneath them. */}
          {result && <CoachingResult result={result} />}
        </div>
      )}
    </div>
  );
}
