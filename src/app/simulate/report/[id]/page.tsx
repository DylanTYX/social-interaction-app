"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  FileText,
  Lightbulb,
  Mic,
  MessageSquare,
  Sparkles,
  Printer,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
} from "@/lib/interview-setup";
import type { PersonaConfig } from "@/lib/persona-engine";
import {
  readCompetencyCoverage,
  readLaunchMeta,
  readLoopProgress,
  type SessionLaunchMeta,
} from "@/lib/session-launch-meta";
import {
  getCurrentRound,
  getNextRoundLoop,
  ROUND_TYPE_LABELS,
  type InterviewRoundType,
} from "@/lib/interview-rounds";
import { isTechnicalRound } from "@/lib/round-types";
import { suggestedBreakMinutes } from "@/lib/interview-progress";
import { ScoreComparison } from "@/components/report/score-comparison";
import { CalibrationCard } from "@/components/report/calibration-card";
import { CompetencyCoverageCard } from "@/components/report/competency-coverage-card";
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
  status: "in_progress" | "completed" | "abandoned";
  summary: string | null;
  turnCount: number;
  averageScore: number | null;
  durationMinutes: number | null;
  metrics: Record<string, unknown> | null;
  startedAt: string;
  endedAt: string | null;
}

interface ReportPayload {
  session: SessionRecord;
  messages: MessageRecord[];
  jobDescription: {
    id: string;
    title: string;
    roleTitle: string | null;
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
        if (!response.ok) {
          const detail = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(
            detail?.error ??
              `Failed to load session (HTTP ${response.status}).`,
          );
        }
        const payload = (await response.json()) as ReportPayload;
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
      <div className="min-h-screen bg-gray-50 px-6 py-8">
        <div className="mx-auto max-w-5xl space-y-4">
          <div className="h-8 w-48 rounded bg-gray-200 animate-pulse" />
          <div className="h-32 rounded-lg bg-gray-200 animate-pulse" />
          <div className="h-72 rounded-lg bg-gray-200 animate-pulse" />
        </div>
      </div>
    );
  }

  if (status === "error" || !data) {
    return (
      <div className="min-h-screen bg-gray-50 px-6 py-8">
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
      if (!response.ok) {
        const detail = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(detail?.error ?? "Could not start the next round.");
      }
      const payload = (await response.json()) as {
        session: {
          id: string;
          practiceMode: "text" | "voice";
          scenarioValue: string;
          personaConfig: PersonaConfig;
        };
        launchMeta: SessionLaunchMeta;
      };
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

  return (
    // `AppShell` owns the scroll container and background now. The back arrow
    // is gone with it — the sidebar is the way out, which is the whole reason
    // this page needed chrome: you land here after every session and had one
    // exit.
    <div className="mx-auto max-w-5xl space-y-6 p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Session report
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">
            {session.scenarioTitle ?? session.scenarioValue}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <ModeIcon className="h-3 w-3" />
            {session.practiceMode === "voice" ? "Voice" : "Text"}
          </Badge>
          <Badge variant="outline">{session.personaName}</Badge>
          <Badge variant="secondary">{session.turnCount} turns</Badge>
          {jobDescription && (
            <Badge
              variant="outline"
              className="border-indigo-200 bg-indigo-50 text-indigo-700"
              title={jobDescription.title}
            >
              <FileText className="mr-1 h-3 w-3" />
              <span className="max-w-[180px] truncate">
                {jobDescription.roleTitle ?? jobDescription.title}
              </span>
            </Badge>
          )}
          <div className="ml-1 flex items-center gap-2 print:hidden">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={handleCopyLink}
            >
              <Link2 className="h-4 w-4" />
              Copy link
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-200/80 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Overall score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">
              {formatScore(overallScore ?? session.averageScore)}
            </p>
            <ScoreComparison
              sessionId={session.id}
              currentScore={overallScore ?? session.averageScore}
              currentStartedAt={session.startedAt}
            />
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Communication
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">
              {confidenceScore === null
                ? "—"
                : `${Math.round(confidenceScore * 10)}%`}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.16em] text-slate-500">
              {usesTechnicalRubric ? "Technical rubric" : "STAR average"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">
              {starScore === null ? "—" : `${Math.round(starScore * 10)}%`}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Duration
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">
              {formatDuration(session.durationMinutes)}
            </p>
          </CardContent>
        </Card>
      </div>

      <CalibrationCard
        sessionId={session.id}
        actualScore={overallScore ?? session.averageScore}
      />

      {loop?.enabled && currentRound && (
        <Card className="border-indigo-200/80 bg-indigo-50/40">
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
                <p className="w-full text-sm text-red-600" role="alert">
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
                className="text-sm font-medium text-indigo-700 hover:underline"
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
                          ? "border-blue-200 bg-blue-50 text-slate-900"
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
                    {isUser && questionForTurn && (
                      <TurnCoaching
                        question={questionForTurn}
                        answer={message.content}
                        roundType={currentRound?.type}
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
    </div>
  );
}

interface ModelAnswerResult {
  modelAnswer: string;
  rewrite: string;
  tips: string[];
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
  sessionId,
  turnIndex,
}: {
  question: string;
  answer: string;
  roundType: InterviewRoundType | undefined;
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
  const [result, setResult] = useState<ModelAnswerResult | null>(null);
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
      const response = await fetch("/api/coach/model-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          answer,
          roundType,
          sessionId,
          turnIndex,
        }),
      });
      const payload = (await response.json()) as ModelAnswerResult & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(
          payload.error ?? "Could not generate a stronger answer.",
        );
      }
      setResult(payload);
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
        className="h-7 gap-1.5 text-xs text-amber-700 hover:bg-amber-50 hover:text-amber-800"
      >
        <Lightbulb className="h-3.5 w-3.5" />
        {open ? "Hide coaching" : "See a stronger answer"}
      </Button>

      {open && (
        <div className="mt-2 space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          {loading && (
            <p className="flex items-center gap-2 text-xs text-amber-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
              Coaching this answer…
            </p>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
          {result && (
            <>
              {result.tips.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                    What to improve
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-slate-700">
                    {result.tips.map((tip, index) => (
                      <li key={index}>{tip}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.rewrite && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                    Your answer, tightened
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                    {result.rewrite}
                  </p>
                </div>
              )}
              {result.modelAnswer && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                    Model answer
                  </p>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                    {result.modelAnswer}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
