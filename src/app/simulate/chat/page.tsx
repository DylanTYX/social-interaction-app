"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Settings2,
} from "lucide-react";

import { ChatInput } from "@/components/chat/chat-input";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { saveInterviewReportSnapshot } from "@/lib/interview-report";
import { SCENARIOS } from "@/lib/constants";
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
  loadInterviewLaunch,
  saveInterviewSetup,
} from "@/lib/interview-setup";

type ChatRole = "user" | "assistant";

type ApiConversationMessage = {
  role: ChatRole;
  content: string;
};

type DisplayMessage = {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
};

type ChatApiResponse = {
  aiMessage: string;
  updatedConversation: ApiConversationMessage[];
  error?: string;
  details?: string;
};

type AnalyzeApiResponse = {
  analysis: AnalysisResult;
  strategy: InterviewStrategy;
  decisionReason: string;
  confidence: number;
  followupPrompt: string;
  followupSummary: string;
  error?: string;
  details?: string;
};

type ScenarioOption = {
  value: string;
  title: string;
  description: string;
};

type StreamEventPayload = {
  chunk?: string;
  error?: string;
  details?: string;
};

const SCENARIO_OPTIONS: ScenarioOption[] = [
  {
    value: "qbr",
    title: SCENARIOS[0].title,
    description: SCENARIOS[0].description,
  },
  {
    value: "conflict",
    title: SCENARIOS[1].title,
    description: SCENARIOS[1].description,
  },
  {
    value: "client-negotiation",
    title: SCENARIOS[2].title,
    description: SCENARIOS[2].description,
  },
  {
    value: "feedback",
    title: SCENARIOS[3].title,
    description: SCENARIOS[3].description,
  },
  {
    value: "presentation",
    title: SCENARIOS[4].title,
    description: SCENARIOS[4].description,
  },
  {
    value: "salary-negotiation",
    title: SCENARIOS[5].title,
    description: SCENARIOS[5].description,
  },
];

const DEFAULT_SETUP = createDefaultInterviewSetup();
const RESPONSE_TIME_LIMIT_SECONDS = 35;

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

function getScenarioByValue(value: string) {
  return (
    SCENARIO_OPTIONS.find((option) => option.value === value) ??
    SCENARIO_OPTIONS[0]
  );
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

async function consumeChatStream(
  response: Response,
  onDelta: (chunk: string) => void,
): Promise<ChatApiResponse> {
  if (!response.body) {
    throw new Error("Streaming response did not include a body.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  let currentData = "";
  let finalResult: ChatApiResponse | null = null;

  const flushEvent = () => {
    const payload = currentData.trim();

    if (!currentEvent || !payload) {
      currentEvent = "";
      currentData = "";
      return;
    }

    if (currentEvent === "delta") {
      const parsed = JSON.parse(payload) as StreamEventPayload;
      if (parsed.chunk) {
        onDelta(parsed.chunk);
      }
    } else if (currentEvent === "done") {
      finalResult = JSON.parse(payload) as ChatApiResponse;
    } else if (currentEvent === "error") {
      const parsed = JSON.parse(payload) as StreamEventPayload;
      throw new Error(parsed.error ?? parsed.details ?? "Streaming failed.");
    }

    currentEvent = "";
    currentData = "";
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();

      if (line.startsWith("event:")) {
        flushEvent();
        currentEvent = line.slice(6).trim();
        continue;
      }

      if (line.startsWith("data:")) {
        currentData += line.slice(5).trim();
        continue;
      }

      if (line === "") {
        flushEvent();
      }
    }
  }

  flushEvent();

  if (!finalResult) {
    throw new Error(
      "Streaming response ended before the final payload arrived.",
    );
  }

  return finalResult;
}

export default function ChatSimulatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activePersonaConfig, setActivePersonaConfig] = useState(
    () => DEFAULT_SETUP.personaConfig,
  );
  const [sessionState, setSessionState] = useState<InterviewSessionState>(() =>
    createInterviewSessionState(createSessionId(), activePersonaConfig.name),
  );
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

  const [activeScenarioValue, setActiveScenarioValue] = useState(
    () => searchParams.get("scenario") ?? DEFAULT_SETUP.scenarioValue,
  );
  const [streamResponses, setStreamResponses] = useState(
    () => searchParams.get("stream") === "1" || DEFAULT_SETUP.streamResponses,
  );
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [conversationHistory, setConversationHistory] = useState<
    ApiConversationMessage[]
  >([]);
  const [isSending, setIsSending] = useState(false);
  const [userTurnKey, setUserTurnKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showLiveCoaching, setShowLiveCoaching] = useState(true);
  const [isAdvancedStateOpen, setIsAdvancedStateOpen] = useState(false);

  const activeScenario = getScenarioByValue(activeScenarioValue);
  const stageLabel = getStageLabel(sessionState.currentStage);
  const stageGuidance = getStageGuidance(
    sessionState.currentStage,
    liveMetrics,
    lastFollowupPrompt,
  );
  const metricTone = getMetricTone(liveMetrics);

  useEffect(() => {
    const storedSetup = loadInterviewLaunch();

    if (!storedSetup) {
      router.replace("/simulate/setup?mode=text");
      return;
    }

    if (storedSetup.practiceMode !== "text") {
      router.replace("/simulate/voice?mode=voice");
      return;
    }

    const nextScenarioValue =
      searchParams.get("scenario") ?? storedSetup.scenarioValue;
    const nextStreamResponses =
      searchParams.get("stream") === null
        ? storedSetup.streamResponses
        : searchParams.get("stream") === "1";

    setActivePersonaConfig(storedSetup.personaConfig);
    setActiveScenarioValue(nextScenarioValue);
    setStreamResponses(nextStreamResponses);
    const scenario = getScenarioByValue(nextScenarioValue);
    const welcomeMessage = buildWelcomeMessage(
      scenario,
      storedSetup.personaConfig.name,
    );

    setMessages([welcomeMessage]);
    setConversationHistory([
      { role: "assistant", content: welcomeMessage.content },
    ]);
    setSessionState(
      createInterviewSessionState(
        createSessionId(),
        storedSetup.personaConfig.name,
      ),
    );
    setAnalysisHistory([]);
    setStrategyHistory([]);
    setLiveMetrics(null);
    setLastFollowupPrompt(null);
    setLastDecisionReason(null);
    setLastStrategy(null);
    setLastDecisionConfidence(null);
    setError(null);
    setIsSending(false);
    setUserTurnKey(0);
  }, [router, searchParams]);

  useEffect(() => {
    saveInterviewSetup({
      scenarioValue: activeScenarioValue,
      streamResponses,
      personaConfig: activePersonaConfig,
      practiceMode: "text",
      voiceConfig: DEFAULT_SETUP.voiceConfig,
    });
  }, [activePersonaConfig, activeScenarioValue, streamResponses]);

  useEffect(() => {
    saveInterviewReportSnapshot({
      sessionState,
      metrics: liveMetrics,
      analyses: analysisHistory,
      strategyHistory,
      scenarioTitle: activeScenario.title,
      scenarioDescription: activeScenario.description,
      personaName: activePersonaConfig.name,
      generatedAt: new Date().toISOString(),
    });
  }, [
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

    const userMessage: DisplayMessage = {
      id: createMessageId(),
      role: "user",
      content: trimmedMessage,
      timestamp: getCurrentTimestamp(),
    };

    const nextMessages = [...messages, userMessage];
    const nextConversationHistory = [
      ...conversationHistory,
      { role: "user" as const, content: trimmedMessage },
    ];

    setMessages(nextMessages);
    setConversationHistory(nextConversationHistory);
    setIsSending(true);
    setError(null);

    try {
      const assistantMessageId = createMessageId();

      const payload = {
        userMessage: trimmedMessage,
        personaName: activePersonaConfig.name,
        personaConfig: activePersonaConfig,
        conversationHistory: nextConversationHistory,
        scenarioName: activeScenario.title,
        scenarioDescription: activeScenario.description,
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
          data = await consumeChatStream(response, (chunk) => {
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

      setConversationHistory(data.updatedConversation);
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

      const analysisResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidateResponse: trimmedMessage,
          question: data.aiMessage,
          personaName: activePersonaConfig.name,
        }),
      });

      const analysisData =
        (await analysisResponse.json()) as AnalyzeApiResponse;

      if (!analysisResponse.ok) {
        setError(
          analysisData.details ??
            analysisData.error ??
            "We could not analyze that response yet.",
        );
        return;
      }

      const decision = {
        strategy: analysisData.strategy as InterviewStrategy,
        reason: analysisData.decisionReason,
        confidence: analysisData.confidence,
        shouldEscalate: analysisData.confidence < 50,
        shouldSlowDown: analysisData.confidence > 80,
        nextFocus:
          analysisData.analysis.followupTopics[0] ?? "specific examples",
      };

      const updatedSessionState = recordInterviewTurn(sessionState, {
        userMessage: trimmedMessage,
        aiMessage: data.aiMessage,
        question: data.aiMessage,
        analysis: analysisData.analysis,
        decision,
      }).state;

      const finalSessionState = isInterviewComplete(updatedSessionState)
        ? markInterviewComplete(updatedSessionState)
        : updatedSessionState;

      const nextAnalysisHistory = [...analysisHistory, analysisData.analysis];
      const nextStrategyHistory = [...strategyHistory, analysisData.strategy];

      setSessionState(finalSessionState);
      setAnalysisHistory(nextAnalysisHistory);
      setStrategyHistory(nextStrategyHistory);
      setLiveMetrics(
        buildInterviewMetrics({
          analyses: nextAnalysisHistory,
          state: finalSessionState,
        }),
      );
      setLastFollowupPrompt(analysisData.followupPrompt);
      setLastDecisionReason(analysisData.decisionReason);
      setLastStrategy(analysisData.strategy);
      setLastDecisionConfidence(analysisData.confidence);
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
        <div className="flex-1">
          <h1 className="text-lg font-semibold">Chat Practice</h1>
          <p className="text-sm text-gray-500">
            {activeScenario.title} • {activePersonaConfig.name} •{" "}
            {streamResponses ? "Streaming enabled" : "Standard mode"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="shadow-soft-sm">
                <Settings2 className="h-4 w-4" />
                <span className="sr-only">Open settings</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => router.push(editSetupHref)}>
                Edit setup
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIsAdvancedStateOpen(true)}>
                Advanced system state
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Link href="/simulate/report">
            <Button
              variant="destructive"
              className="shadow-soft-md hover:shadow-soft-lg transition-all duration-200"
            >
              End Session
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden bg-linear-to-br from-slate-50 via-white to-sky-50/60 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-slate-200/70 bg-linear-to-r from-white via-slate-50 to-blue-50/50 px-6 py-4 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Interview room
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
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
                />
              ))}

              {error && (
                <Card className="border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-amber-900 dark:text-amber-200">
                      Coaching note
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      {error}
                    </p>
                  </CardContent>
                </Card>
              )}

              {isSending && (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" />
                  Generating interviewer response...
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-slate-200/70 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
            <ChatInput
              key={userTurnKey}
              onSend={handleSend}
              disabled={isSending}
              timeLimitSeconds={RESPONSE_TIME_LIMIT_SECONDS}
              timeoutFallbackMessage="[No response submitted before time expired.]"
            />
          </div>
        </div>

        <div className="hidden xl:flex">
          {showLiveCoaching ? (
            <div className="relative h-full border-l border-slate-200/80 p-4 dark:border-slate-800">
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute -left-4 top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950"
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
            <div className="flex h-full w-12 items-center justify-center border-l border-slate-200/80 bg-white/80 shadow-soft backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full border border-slate-200 bg-white shadow-soft dark:border-slate-800 dark:bg-slate-950"
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
        <DialogContent className="max-w-3xl border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
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
