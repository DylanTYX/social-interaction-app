"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Settings2,
} from "lucide-react";

import { ChatInput } from "@/components/chat/chat-input";
import { CodeInput } from "@/components/chat/code-input";
import { ChatMessage } from "@/components/chat/chat-message";
import { InterviewStatePanel } from "@/components/chat/interview-state-panel";
import { LiveFeedbackSidebar } from "@/components/chat/live-feedback-sidebar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  computeAverageScore,
  type InterviewReportSnapshot,
} from "@/lib/interview-report";
import { appendDimensionSnapshot } from "@/lib/session-launch-meta";
import {
  scenarioFromBootstrap,
  useInterviewSessionBootstrap,
} from "@/hooks/use-interview-session-bootstrap";
import type { MicroFeedbackTone } from "@/lib/micro-feedback";
import {
  createInterviewSessionState,
  isInterviewComplete,
  markInterviewComplete,
  recordInterviewTurn,
  type InterviewSessionState,
} from "@/lib/interviewStateMachine";
import {
  buildInterviewMetrics,
  type InterviewMetrics,
} from "@/lib/metricsTracker";
import {
  type AnalysisResult,
  type InterviewStrategy,
} from "@/lib/responseAnalyzer";
import {
  createDefaultInterviewSetup,
  saveInterviewSetup,
} from "@/lib/interview-setup";
import { consumeChatStream } from "@/lib/chat-stream";
import { resolveAnswerFormat } from "@/lib/interview-rounds";

type DisplayMessage = {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
  feedbackHint?: string | null;
  feedbackTone?: MicroFeedbackTone;
  feedbackLoading?: boolean;
};

type ChatApiResponse = {
  aiMessage: string;
  turnCount: number;
  summary: string | null;
  // The chat route now analyzes the user's answer inline and returns the
  // verdict here, so the client no longer makes a separate /api/analyze call.
  analysis: AnalysisResult | null;
  strategy: InterviewStrategy | null;
  decisionReason: string | null;
  confidence: number | null;
  shouldEscalate: boolean | null;
  shouldSlowDown: boolean | null;
  followupSummary: string | null;
  microFeedback: { hint: string; tone: MicroFeedbackTone } | null;
  error?: string;
  details?: string;
};

type ScenarioOption = {
  value: string;
  title: string;
  description: string;
};

const DEFAULT_SETUP = createDefaultInterviewSetup();
const RESPONSE_TIME_LIMIT_SECONDS = 300; // 5 minutes per answer

function getCurrentTimestamp() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createSessionId() {
  return `session-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createMessageId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `msg-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function buildWelcomeMessage(
  scenario: ScenarioOption,
  personaLabel: string,
): DisplayMessage {
  return {
    id: "welcome",
    role: "ai",
    content: `Welcome to ${scenario.title} practice with ${personaLabel}. ${scenario.description} Start with your opening response whenever you're ready.`,
    timestamp: getCurrentTimestamp(),
  };
}

function getStageLabel(stage: InterviewSessionState["currentStage"]): string {
  switch (stage) {
    case "intro":
      return "Opening";
    case "questioning":
      return "Exploration";
    case "analysis":
      return "Review";
    case "strategy":
      return "Decision";
    case "followup":
      return "Follow-up";
    case "wrap_up":
      return "Wrap-up";
    case "report":
      return "Report";
    default:
      return "In progress";
  }
}

function getStageGuidance(
  stage: InterviewSessionState["currentStage"],
  metrics: InterviewMetrics | null,
  prompt: string | null,
): string {
  if (stage === "intro") {
    return "Start broad, then narrow toward a concrete example.";
  }

  if (stage === "questioning") {
    return "Keep the candidate talking in STAR form and collect specifics.";
  }

  if (stage === "analysis") {
    return "The response has been analyzed. Use the follow-up to push depth.";
  }

  if (stage === "strategy") {
    return metrics && metrics.averageOverallScore > 75
      ? "The answer is strong. Shift toward trade-offs and reasoning."
      : "Target the weakest STAR element with the next question.";
  }

  if (stage === "followup") {
    return prompt
      ? `Adaptive follow-up ready: ${prompt}`
      : "Ask the next targeted question and watch for specificity.";
  }

  if (stage === "wrap_up") {
    return "Close with reflection, lessons learned, and a final check on impact.";
  }

  if (stage === "report") {
    return "Session complete. Review the summary and performance trends.";
  }

  return "Continue the interview and adjust difficulty based on the last answer.";
}

function getMetricTone(metrics: InterviewMetrics | null): string {
  if (!metrics) {
    return "Waiting for the first scored response.";
  }

  if (metrics.improvementTrend === "improving") {
    return "The candidate is improving across responses.";
  }

  if (metrics.improvementTrend === "declining") {
    return "The candidate is losing specificity or confidence.";
  }

  return "The response quality is holding steady.";
}

export default function ChatSimulatePage() {
  return (
    <Suspense fallback={<ChatLoadingFallback />}>
      <ChatSimulateInner />
    </Suspense>
  );
}

function ChatLoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
        Preparing chat session...
      </div>
    </div>
  );
}

function ChatSimulateInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bootstrap = useInterviewSessionBootstrap(searchParams, "text");

  const activePersonaConfig = bootstrap.personaConfig;
  const activeScenarioValue = bootstrap.scenarioValue;
  const streamResponses = bootstrap.streamResponses;
  const liveCoachingEnabled = bootstrap.liveCoachingEnabled;
  const [liveCoachingOn, setLiveCoachingOn] = useState(liveCoachingEnabled);
  const initialState = bootstrap;

  const [sessionState, setSessionState] = useState<InterviewSessionState>(() =>
    createInterviewSessionState(
      bootstrap.sessionId ?? createSessionId(),
      bootstrap.personaConfig.name,
    ),
  );

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [messagesHydrated, setMessagesHydrated] = useState(false);
  const [dimensionSnapshots, setDimensionSnapshots] = useState<
    import("@/lib/session-launch-meta").DimensionSnapshot[]
  >([]);

  const [analysisHistory, setAnalysisHistory] = useState<AnalysisResult[]>([]);
  const [strategyHistory, setStrategyHistory] = useState<InterviewStrategy[]>(
    [],
  );
  const [liveMetrics, setLiveMetrics] = useState<InterviewMetrics | null>(null);
  const [lastFollowupPrompt, setLastFollowupPrompt] = useState<string | null>(
    null,
  );
  const [lastDecisionReason, setLastDecisionReason] = useState<string | null>(
    null,
  );
  const [lastStrategy, setLastStrategy] = useState<string | null>(null);
  const [lastDecisionConfidence, setLastDecisionConfidence] = useState<
    number | null
  >(null);
  const [isSending, setIsSending] = useState(false);
  const [userTurnKey, setUserTurnKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showLiveCoaching, setShowLiveCoaching] = useState(
    liveCoachingEnabled,
  );

  useEffect(() => {
    setLiveCoachingOn(liveCoachingEnabled);
    setShowLiveCoaching(liveCoachingEnabled);
  }, [liveCoachingEnabled]);
  const [isAdvancedStateOpen, setIsAdvancedStateOpen] = useState(false);
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const handleEndSession = async () => {
    if (isEnding) return;
    setIsEnding(true);
    const sessionId = bootstrap.sessionId ?? initialState.sessionId;
    if (sessionId) {
      const finalMetrics = buildInterviewMetrics({
        analyses: analysisHistory,
        state: sessionState,
      });
      const startedAtMs = Date.parse(sessionState.createdAt);
      const durationMinutes = Number.isFinite(startedAtMs)
        ? Math.max(1, Math.round((Date.now() - startedAtMs) / 60000))
        : null;
      const completedSnapshot: InterviewReportSnapshot = {
        sessionState: markInterviewComplete(sessionState),
        metrics: finalMetrics,
        analyses: analysisHistory,
        strategyHistory,
        scenarioTitle: activeScenario.title,
        scenarioDescription: activeScenario.description,
        personaName: activePersonaConfig.name,
        generatedAt: new Date().toISOString(),
        jobDescription: initialState.jobDescriptionRef,
      };
      const averageScore = computeAverageScore(completedSnapshot);
      try {
        // Only the score metrics are sent. `launch` and `loop` belong to the
        // server (it wrote them at launch and merges our keys over them), and
        // rebuilding them here from client defaults used to overwrite the real
        // JD/resume config with blanks.
        await fetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "completed",
            averageScore,
            durationMinutes,
            metrics: finalMetrics,
            endedAt: new Date().toISOString(),
          }),
        });
      } catch {
        // best-effort; the user still gets routed to the report page
      }
      router.push(`/simulate/report/${sessionId}`);
    } else {
      router.push("/dashboard");
    }
  };

  const activeScenario = scenarioFromBootstrap(bootstrap);
  // Technical rounds get a real editor instead of a chat box. Scoring already
  // asked for correctness, complexity and code quality; the interface just had
  // no way to accept code.
  const activeRound =
    bootstrap.interviewLoop.rounds[bootstrap.interviewLoop.currentRoundIndex];
  const answerFormat = resolveAnswerFormat(activeRound);
  const stageLabel = getStageLabel(sessionState.currentStage);
  const stageGuidance = getStageGuidance(
    sessionState.currentStage,
    liveMetrics,
    lastFollowupPrompt,
  );
  const metricTone = getMetricTone(liveMetrics);

  // Handle redirects without doing setState here — the lazy initializers
  // above already populated all state slots from the launch payload, so this
  // effect only ever performs side effects.
  useEffect(() => {
    if (bootstrap.status === "redirect-setup") {
      router.replace("/simulate/setup?mode=text");
    } else if (bootstrap.status === "redirect-voice") {
      router.replace("/simulate/voice?mode=voice");
    }
  }, [bootstrap.status, router]);

  useEffect(() => {
    if (bootstrap.status !== "ready" || messagesHydrated) return;

    const resumeId = searchParams.get("session");
    if (resumeId && bootstrap.sessionId) {
      let cancelled = false;
      const hydrate = async () => {
        try {
          const response = await fetch(
            `/api/sessions/${encodeURIComponent(resumeId)}/resume`,
            { cache: "no-store" },
          );
          if (!response.ok) throw new Error("Failed to load messages.");
          const { messages: rows } = (await response.json()) as {
            messages: Array<{
              id: string;
              role: string;
              content: string;
              createdAt: string;
            }>;
          };
          if (cancelled) return;
          const restored: DisplayMessage[] = rows.map((row) => ({
            id: row.id,
            role: row.role === "user" ? "user" : "ai",
            content: row.content,
            timestamp: new Date(row.createdAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            }),
          }));
          setMessages(
            restored.length > 0
              ? restored
              : [
                  buildWelcomeMessage(
                    activeScenario,
                    bootstrap.personaConfig.name,
                  ),
                ],
          );
        } catch {
          if (!cancelled) {
            setMessages([
              buildWelcomeMessage(activeScenario, bootstrap.personaConfig.name),
            ]);
          }
        } finally {
          if (!cancelled) setMessagesHydrated(true);
        }
      };
      queueMicrotask(() => void hydrate());
      return () => {
        cancelled = true;
      };
    }

    setMessages([
      buildWelcomeMessage(activeScenario, bootstrap.personaConfig.name),
    ]);
    setMessagesHydrated(true);
  }, [
    bootstrap.status,
    bootstrap.sessionId,
    bootstrap.personaConfig.name,
    activeScenario,
    messagesHydrated,
    searchParams,
  ]);

  useEffect(() => {
    if (bootstrap.status !== "ready") return;
    saveInterviewSetup({
      scenarioValue: activeScenarioValue,
      streamResponses,
      liveCoachingEnabled,
      personaConfig: activePersonaConfig,
      practiceMode: "text",
      interviewLoop: bootstrap.interviewLoop,
      voiceConfig: DEFAULT_SETUP.voiceConfig,
      jobDescription: DEFAULT_SETUP.jobDescription,
      resume: DEFAULT_SETUP.resume,
    });
  }, [
    bootstrap.status,
    activePersonaConfig,
    activeScenarioValue,
    streamResponses,
    liveCoachingEnabled,
    bootstrap.interviewLoop,
  ]);

  useEffect(() => {
    // Mirror progress to the Supabase session row so the dashboard stays in
    // sync. Fire-and-forget; failures are silent.
    if (!bootstrap.sessionId || analysisHistory.length === 0) return;

    const snapshot: InterviewReportSnapshot = {
      sessionState,
      metrics: liveMetrics,
      analyses: analysisHistory,
      strategyHistory,
      scenarioTitle: activeScenario.title,
      scenarioDescription: activeScenario.description,
      personaName: activePersonaConfig.name,
      generatedAt: new Date().toISOString(),
      jobDescription: initialState.jobDescriptionRef,
    };

    const averageScore = computeAverageScore(snapshot);
    void fetch(`/api/sessions/${bootstrap.sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        averageScore,
        metrics: liveMetrics,
      }),
    }).catch(() => {
      // ignore; the report page reads from Supabase directly
    });
  }, [
    initialState.sessionId,
    initialState.jobDescriptionRef,
    sessionState,
    liveMetrics,
    analysisHistory,
    strategyHistory,
    activeScenario.title,
    activeScenario.description,
    activePersonaConfig.name,
  ]);

  const handleSend = async (message: string) => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || isSending) {
      return;
    }

    if (!initialState.sessionId) {
      setError(
        "This session is not connected to the database. Please start a new interview from the setup page.",
      );
      return;
    }

    const userMessage: DisplayMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmedMessage,
      timestamp: getCurrentTimestamp(),
      feedbackLoading: liveCoachingOn,
    };

    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);
    setIsSending(true);
    setError(null);

    try {
      const assistantMessageId = createMessageId();

      const payload = {
        sessionId: initialState.sessionId,
        userMessage: trimmedMessage,
        streamResponse: streamResponses,
      };

      if (streamResponses) {
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: assistantMessageId,
            role: "ai",
            content: "",
            timestamp: getCurrentTimestamp(),
          },
        ]);
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as Partial<ChatApiResponse>;
        throw new Error(errorData.error ?? "Failed to generate AI response.");
      }

      let data: ChatApiResponse;

      if (streamResponses) {
        try {
          data = await consumeChatStream<ChatApiResponse>(response, (chunk) => {
            setMessages((currentMessages) =>
              currentMessages.map((item) =>
                item.id === assistantMessageId
                  ? { ...item, content: `${item.content}${chunk}` }
                  : item,
              ),
            );
          });
        } catch {
          const fallbackResponse = await fetch("/api/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...payload, streamResponse: false }),
          });

          if (!fallbackResponse.ok) {
            const errorData =
              (await fallbackResponse.json()) as Partial<ChatApiResponse>;
            throw new Error(
              errorData.error ?? "Failed to generate AI response.",
            );
          }

          data = (await fallbackResponse.json()) as ChatApiResponse;
        }
      } else {
        data = (await response.json()) as ChatApiResponse;
      }

      if (streamResponses) {
        setMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === assistantMessageId
              ? {
                  ...message,
                  content: data.aiMessage,
                }
              : message,
          ),
        );
      } else {
        const aiMessage: DisplayMessage = {
          id: assistantMessageId,
          role: "ai",
          content: data.aiMessage,
          timestamp: getCurrentTimestamp(),
        };

        setMessages((currentMessages) => [...currentMessages, aiMessage]);
      }

      setUserTurnKey((currentKey) => currentKey + 1);

      if (trimmedMessage.length < 10) {
        setError("Please provide a longer answer so we can analyze it.");
        return;
      }

      if (!data.aiMessage || !data.aiMessage.trim()) {
        setError(
          "The interviewer did not return a usable prompt. Try again or disable streaming.",
        );
        return;
      }

      // The hint now arrives with the reply, derived from the same analysis
      // that produced the score. It used to be a second round-trip to
      // /api/analyze/micro, which made its own model call — a third of the
      // LLM calls in a text session — to restate what the analyzer already
      // knew, and could contradict the score shown next to it.
      if (liveCoachingOn) {
        const micro = data.microFeedback;
        setMessages((current) =>
          current.map((item) =>
            item.id === userMessage.id
              ? {
                  ...item,
                  feedbackHint: micro?.hint,
                  feedbackTone: micro?.tone,
                  feedbackLoading: false,
                }
              : item,
          ),
        );
      }

      // The interviewer already scored this answer inline. Trivial answers
      // ("yes", "ready") come back with analysis null — skip the scored-turn
      // bookkeeping for those.
      if (!data.analysis || !data.strategy) {
        return;
      }

      const analysisResult = data.analysis;
      const turnStrategy = data.strategy;
      const turnConfidence = data.confidence ?? 50;

      // Escalation flags come from the server's own decision, not a guess
      // re-derived from `confidence`. The two used different rules and
      // disagreed regularly.
      const decision = {
        strategy: turnStrategy,
        reason: data.decisionReason ?? "",
        confidence: turnConfidence,
        shouldEscalate: data.shouldEscalate ?? false,
        shouldSlowDown: data.shouldSlowDown ?? false,
        nextFocus: analysisResult.followupTopics?.[0] ?? "specific examples",
      };

      const updatedSessionState = recordInterviewTurn(sessionState, {
        userMessage: trimmedMessage,
        aiMessage: data.aiMessage,
        question: data.aiMessage,
        analysis: analysisResult,
        decision,
      }).state;

      const finalSessionState = isInterviewComplete(updatedSessionState)
        ? markInterviewComplete(updatedSessionState)
        : updatedSessionState;

      const nextAnalysisHistory = [...analysisHistory, analysisResult];
      const nextStrategyHistory = [...strategyHistory, turnStrategy];

      setSessionState(finalSessionState);
      setAnalysisHistory(nextAnalysisHistory);
      setStrategyHistory(nextStrategyHistory);
      const nextMetrics = buildInterviewMetrics({
        analyses: nextAnalysisHistory,
        state: finalSessionState,
      });
      setLiveMetrics(nextMetrics);

      if (bootstrap.sessionId) {
        const metricsPayload = appendDimensionSnapshot(
          { dimensionSnapshots },
          analysisResult,
        );
        const nextSnapshots = metricsPayload.dimensionSnapshots ?? [];
        setDimensionSnapshots(nextSnapshots);
        void fetch(`/api/sessions/${bootstrap.sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            averageScore: analysisResult.overallScore,
            metrics: { ...nextMetrics, ...metricsPayload },
          }),
        }).catch(() => {
          // ignore
        });
      }
      setLastFollowupPrompt(data.followupSummary);
      setLastDecisionReason(data.decisionReason);
      setLastStrategy(turnStrategy);
      setLastDecisionConfidence(turnConfidence);

      if (initialState.sessionId && isInterviewComplete(finalSessionState)) {
        const finalMetrics = buildInterviewMetrics({
          analyses: nextAnalysisHistory,
          state: finalSessionState,
        });
        const completedSnapshot: InterviewReportSnapshot = {
          sessionState: finalSessionState,
          metrics: finalMetrics,
          analyses: nextAnalysisHistory,
          strategyHistory: nextStrategyHistory,
          scenarioTitle: activeScenario.title,
          scenarioDescription: activeScenario.description,
          personaName: activePersonaConfig.name,
          generatedAt: new Date().toISOString(),
          jobDescription: initialState.jobDescriptionRef,
        };
        const averageScore = computeAverageScore(completedSnapshot);
        const startedAtMs = Date.parse(finalSessionState.createdAt);
        const durationMinutes = Number.isFinite(startedAtMs)
          ? Math.max(1, Math.round((Date.now() - startedAtMs) / 60000))
          : null;
        void fetch(`/api/sessions/${bootstrap.sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "completed",
            averageScore,
            durationMinutes,
            metrics: finalMetrics,
            endedAt: new Date().toISOString(),
          }),
        }).catch(() => {
          // ignore; local snapshot drives the report page
        });
      }
    } catch (requestError) {
      const messageText =
        requestError instanceof Error
          ? requestError.message
          : "Unable to reach the chat API.";
      setError(messageText);
    } finally {
      setIsSending(false);
    }
  };

  const editSetupHref = `/simulate/setup?scenario=${activeScenarioValue}&stream=${streamResponses ? "1" : "0"}`;

  if (bootstrap.status === "loading" || !messagesHydrated) {
    return <ChatLoadingFallback />;
  }

  if (bootstrap.status === "error") {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 px-6">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Could not open session</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-600">{bootstrap.error}</p>
            <Link href="/dashboard/sessions">
              <Button>Back to sessions</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="h-16 bg-white border-b border-gray-200/80 flex items-center px-6 gap-4 shadow-soft">
        <Link href="/dashboard">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-gray-100 transition-colors duration-150"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold">Chat practice</h1>
          <p className="text-sm text-gray-500 truncate">
            {activeScenario.title} • {activePersonaConfig.name} •{" "}
            {streamResponses ? "Streaming enabled" : "Standard mode"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {initialState.jobDescriptionTitle && (
            <span
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
              title={initialState.jobDescriptionTitle}
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="max-w-[160px] truncate">
                {initialState.jobDescriptionTitle}
              </span>
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="shadow-soft">
                <Settings2 className="h-4 w-4" />
                <span className="sr-only">Open settings</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => router.push(editSetupHref)}>
                Edit setup
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  const next = !liveCoachingOn;
                  setLiveCoachingOn(next);
                  setShowLiveCoaching(next);
                  saveInterviewSetup({
                    ...DEFAULT_SETUP,
                    scenarioValue: activeScenarioValue,
                    streamResponses,
                    liveCoachingEnabled: next,
                    personaConfig: activePersonaConfig,
                    practiceMode: "text",
                    interviewLoop: bootstrap.interviewLoop,
                    voiceConfig: DEFAULT_SETUP.voiceConfig,
                    jobDescription: DEFAULT_SETUP.jobDescription,
                  });
                }}
              >
                {liveCoachingOn
                  ? "Turn off live coaching"
                  : "Turn on live coaching"}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIsAdvancedStateOpen(true)}>
                Advanced system state
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            variant="destructive"
            onClick={() => setIsEndDialogOpen(true)}
            className="shadow-soft-md hover:shadow-soft-lg transition-all duration-200"
          >
            End session
          </Button>
        </div>
      </div>

      <Dialog
        open={isEndDialogOpen}
        onOpenChange={(open) => {
          if (!isEnding) setIsEndDialogOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>End this session?</DialogTitle>
            <DialogDescription>
              We&apos;ll generate the feedback report from the conversation so
              far. Once a session is ended you can&apos;t resume it — start a
              fresh practice when you&apos;re ready.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEndDialogOpen(false)}
              disabled={isEnding}
            >
              Keep practicing
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleEndSession()}
              disabled={isEnding}
            >
              {isEnding ? "Ending..." : "End and view report"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-1 overflow-hidden bg-linear-to-br from-slate-50 via-white to-sky-50/60">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-slate-200/70 bg-linear-to-r from-white via-slate-50 to-blue-50/50 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Interview room
                </div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Adaptive session in progress
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="h-8 px-3">
                  {streamResponses ? "Streaming on" : "Streaming off"}
                </Badge>
                <Badge variant="outline" className="h-8 px-3">
                  {metricTone}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              {messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  timestamp={msg.timestamp}
                  personaName={activePersonaConfig.name}
                  feedbackHint={msg.feedbackHint}
                  feedbackTone={msg.feedbackTone}
                  feedbackLoading={msg.feedbackLoading}
                />
              ))}

              {error && (
                <Card className="border-amber-200 bg-amber-50/80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-amber-900">
                      Coaching note
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-amber-800">
                      {error}
                    </p>
                  </CardContent>
                </Card>
              )}

              {isSending && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
                  Generating interviewer response...
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200/70 bg-white/80 p-4 backdrop-blur">
            {answerFormat === "code" ? (
              <CodeInput
                key={userTurnKey}
                onSend={handleSend}
                disabled={isSending}
              />
            ) : (
              <ChatInput
                key={userTurnKey}
                onSend={handleSend}
                disabled={isSending}
                timeLimitSeconds={RESPONSE_TIME_LIMIT_SECONDS}
                timeoutFallbackMessage="[No response submitted before time expired.]"
              />
            )}
          </div>
        </div>

        <div className="hidden xl:flex">
          {showLiveCoaching ? (
            <div className="relative h-full border-l border-slate-200/80 p-4">
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute -left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white shadow-soft"
                onClick={() => setShowLiveCoaching(false)}
                aria-label="Collapse live coaching"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <LiveFeedbackSidebar
                metrics={liveMetrics}
                analyses={analysisHistory}
                followupPrompt={lastFollowupPrompt}
              />
            </div>
          ) : (
            <div className="flex h-full w-12 items-center justify-center border-l border-slate-200/80 bg-white/80 shadow-soft backdrop-blur">
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full border border-slate-200 bg-white shadow-soft"
                onClick={() => setShowLiveCoaching(true)}
                aria-label="Expand live coaching"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isAdvancedStateOpen} onOpenChange={setIsAdvancedStateOpen}>
        <DialogContent className="max-w-3xl border-slate-200 bg-white/95 backdrop-blur">
          <DialogHeader className="text-left">
            <DialogTitle>Advanced system state</DialogTitle>
            <DialogDescription>
              Internal interview strategy and decision context for debugging and optimization.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <InterviewStatePanel
              state={sessionState}
              stageLabel={stageLabel}
              stageGuidance={stageGuidance}
              lastStrategy={lastStrategy ? (lastStrategy as InterviewStrategy) : null}
              decisionReason={lastDecisionReason}
              decisionConfidence={lastDecisionConfidence}
              metrics={liveMetrics}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
