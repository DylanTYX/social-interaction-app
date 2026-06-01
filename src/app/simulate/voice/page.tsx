"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Settings2,
  Mic,
  Square,
  AlertCircle,
} from "lucide-react";

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
import { getSpeechService, type TranscriptResult } from "@/lib/speechService";

const RESPONSE_TIME_LIMIT_SECONDS = 35;

type DisplayMessage = {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
};

type ChatRole = "user" | "assistant";

type ApiConversationMessage = {
  role: ChatRole;
  content: string;
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
    value: "conflict",
    title: "Handling Conflict",
    description: "Navigate disagreements effectively",
  },
  {
    value: "feedback",
    title: "Receiving Feedback",
    description: "Accept criticism constructively",
  },
  {
    value: "delegation",
    title: "Delegation",
    description: "Assign and oversee tasks",
  },
  {
    value: "negotiation",
    title: "Negotiation",
    description: "Reach mutually beneficial outcomes",
  },
  {
    value: "mentoring",
    title: "Mentoring",
    description: "Guide and develop others",
  },
  {
    value: "crisis",
    title: "Crisis Management",
    description: "Handle high-pressure situations",
  },
];

const DEFAULT_SETUP = createDefaultInterviewSetup();

function createSessionId(): string {
  return `voice-session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

export default function VoiceSimulatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Setup validation
  const [isLoading, setIsLoading] = useState(true);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Interview state
  const [activePersonaConfig, setActivePersonaConfig] = useState(
    () => DEFAULT_SETUP.personaConfig,
  );
  const [activeScenarioValue, setActiveScenarioValue] = useState(
    () => DEFAULT_SETUP.scenarioValue,
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
  const [lastDecisionReason, setLastDecisionReason] = useState<string>("");
  const [lastStrategy, setLastStrategy] = useState<InterviewStrategy | null>(
    null,
  );
  const [lastDecisionConfidence, setLastDecisionConfidence] = useState(0);

  // Message display
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const speechServiceRef = useRef(getSpeechService());
  const recordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptBufferRef = useRef("");
  const isStoppingRef = useRef(false);
  const openingGeneratedRef = useRef(false);
  const userTurnKeyRef = useRef(0);

  // Sidebar state
  const [showLiveCoaching, setShowLiveCoaching] = useState(true);
  const [isAdvancedStateOpen, setIsAdvancedStateOpen] = useState(false);

  const activeScenario =
    SCENARIO_OPTIONS.find((s) => s.value === activeScenarioValue) ||
    SCENARIO_OPTIONS[0];

  const stageLabel = `Stage: ${sessionState.currentStage}`;
  const stageGuidance = "";
  const metricTone = getMetricTone(liveMetrics);

  // Initialize and validate setup
  useEffect(() => {
    const launch = loadInterviewLaunch();

    if (!launch) {
      setSetupError("Interview setup required");
      setTimeout(() => router.push("/simulate/setup?mode=voice"), 100);
      return;
    }

    if (launch.practiceMode !== "voice") {
      router.push("/simulate/chat");
      return;
    }

    setActiveScenarioValue(launch.scenarioValue);
    setActivePersonaConfig(launch.personaConfig);

    // Initialize speech service with Azure credentials
    // NOTE: In production, these should come from environment variables or secure config
    const speechService = speechServiceRef.current;
    const azureKey = process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY;
    const azureRegion = process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION;

    if (!azureKey || !azureRegion) {
      setSetupError(
        "Azure Speech credentials not configured. Voice interview requires Azure Speech Service.",
      );
      return;
    }

    speechService.initialize({
      subscriptionKey: azureKey,
      region: azureRegion,
    });

    setIsLoading(false);

    return () => {
      const speechService = speechServiceRef.current;
      speechService.cleanup();
    };
  }, [router]);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup: stop recording and audio when leaving page
  useEffect(() => {
    return () => {
      const speechService = speechServiceRef.current;
      if (isRecording) {
        speechService.stopListening().catch(() => {
          // Ignore errors during cleanup
        });
      }

      // Cancel any browser speech synthesis
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isRecording]);

  // Generate opening greeting from interviewer
  useEffect(() => {
    if (
      !activePersonaConfig ||
      !activeScenarioValue ||
      messages.length > 0 ||
      openingGeneratedRef.current
    ) {
      return;
    }

    openingGeneratedRef.current = true;

    const generateOpening = async () => {
      try {
        const scenario =
          SCENARIO_OPTIONS.find((s) => s.value === activeScenarioValue) ||
          SCENARIO_OPTIONS[0];

        const openingPrompt =
          "You are about to start an interview. Your job is to greet the candidate, introduce yourself and briefly describe your role, " +
          "explain the scenario they'll be interviewed for, and ask if they're ready to begin. Keep it concise and friendly (2-3 sentences). " +
          "Make sure they understand what to expect.";

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userMessage: openingPrompt,
            conversationHistory: [],
            personaConfig: activePersonaConfig,
            scenarioName: scenario.title,
            scenarioDescription: scenario.description,
            streamResponse: false,
          }),
        });

        if (!response.ok) {
          console.warn("Failed to generate opening greeting");
          return;
        }

        const data = (await response.json()) as ChatApiResponse;
        const openingMessage: DisplayMessage = {
          id: `msg-${Date.now()}-opening`,
          role: "ai",
          content: data.aiMessage,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        };

        setMessages([openingMessage]);

        // Auto-play opening greeting if TTS is enabled
        const launch = loadInterviewLaunch();
        if (launch?.voiceConfig?.ttsEnabled) {
          const speechService = speechServiceRef.current;
          try {
            await speechService.speak(
              data.aiMessage,
              launch.voiceConfig.selectedVoiceUri,
            );
          } catch (ttsError) {
            console.warn("TTS failed for opening greeting:", ttsError);
          }
        }
      } catch (err) {
        console.warn("Error generating opening greeting:", err);
      }
    };

    generateOpening();
  }, []);

  // Start listening when recording
  const handleStartRecording = async () => {
    const speechService = speechServiceRef.current;

    if (!speechService.isInitialized()) {
      setRecordingError("Speech service not initialized");
      return;
    }

    try {
      setRecordingError(null);
      setFinalTranscript("");
      setInterimTranscript("");
      transcriptBufferRef.current = "";
      isStoppingRef.current = false;
      setIsRecording(true);

      // Set timeout to auto-stop recording after time limit
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }

      recordingTimeoutRef.current = setTimeout(() => {
        handleStopRecording();
      }, RESPONSE_TIME_LIMIT_SECONDS * 1000);

      await speechService.startListening(
        (result: TranscriptResult) => {
          if (result.final) {
            const finalText = result.final.trim();

            if (finalText) {
              transcriptBufferRef.current = [
                transcriptBufferRef.current,
                finalText,
              ]
                .filter(Boolean)
                .join(" ")
                .trim();
              setFinalTranscript(transcriptBufferRef.current);
            }

            setInterimTranscript("");
          } else if (result.interim) {
            setInterimTranscript(result.interim);
          }
        },
        (errorMsg: string) => {
          setRecordingError(errorMsg);
          setIsRecording(false);
          if (recordingTimeoutRef.current) {
            clearTimeout(recordingTimeoutRef.current);
          }
        },
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Recording failed";
      setRecordingError(errorMessage);
      setIsRecording(false);
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }
    }
  };

  const handleStopRecording = async () => {
    const speechService = speechServiceRef.current;

    if (isStoppingRef.current) {
      return;
    }

    isStoppingRef.current = true;

    try {
      await speechService.stopListening();
      setIsRecording(false);

      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }

      const combinedTranscript = [
        transcriptBufferRef.current,
        interimTranscript,
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

      transcriptBufferRef.current = "";
      setFinalTranscript("");
      setInterimTranscript("");

      if (combinedTranscript) {
        await handleSubmitTranscript(combinedTranscript);
      } else {
        setRecordingError("No speech detected. Please try again.");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to stop recording";
      setRecordingError(errorMessage);
    } finally {
      isStoppingRef.current = false;
    }
  };

  const handleSubmitTranscript = async (transcript: string) => {
    if (!transcript.trim()) {
      setRecordingError("No speech detected. Please try again.");
      return;
    }

    await handleSend(transcript);
  };

  const handleSend = async (userMessage: string) => {
    if (isSending) return;

    try {
      setError(null);
      setIsSending(true);

      // Add user message to display
      const userMessageId = `msg-${Date.now()}-user`;
      setMessages((prev) => [
        ...prev,
        {
          id: userMessageId,
          role: "user",
          content: userMessage,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);

      // Get AI response
      const chatResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage,
          conversationHistory: messages.map((m) => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.content,
          })),
          personaConfig: activePersonaConfig,
          scenarioName: activeScenario.title,
          scenarioDescription: activeScenario.description,
          streamResponse: false,
        }),
      });

      if (!chatResponse.ok) {
        const errorData = (await chatResponse.json().catch(() => null)) as {
          error?: string;
          details?: string;
        } | null;

        throw new Error(
          errorData?.details ||
            errorData?.error ||
            `Chat API error: ${chatResponse.statusText}`,
        );
      }

      let aiMessage = "";

      if (
        chatResponse.headers.get("content-type")?.includes("text/event-stream")
      ) {
        // Streaming response
        const result = await consumeChatStream(chatResponse, (chunk) => {
          aiMessage += chunk;
        });
        aiMessage = result.aiMessage;
      } else {
        // Standard response
        const result = (await chatResponse.json()) as ChatApiResponse;
        aiMessage = result.aiMessage;
      }

      // Add AI message to display
      const aiMessageId = `msg-${Date.now()}-ai`;
      setMessages((prev) => [
        ...prev,
        {
          id: aiMessageId,
          role: "ai",
          content: aiMessage,
          timestamp: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);

      // TTS: Speak AI response if enabled
      const launch = loadInterviewLaunch();
      if (launch?.voiceConfig?.ttsEnabled) {
        const speechService = speechServiceRef.current;
        try {
          await speechService.speak(
            aiMessage,
            launch.voiceConfig.selectedVoiceUri,
          );
        } catch (ttsError) {
          console.warn("TTS failed, continuing:", ttsError);
        }
      }

      // Analyze response
      const analyzeResponse = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateResponse: userMessage,
          question: aiMessage,
          personaName: activePersonaConfig.name,
        }),
      });

      if (!analyzeResponse.ok) {
        const errorData = (await analyzeResponse.json().catch(() => null)) as {
          error?: string;
          details?: string;
        } | null;

        throw new Error(
          errorData?.details ||
            errorData?.error ||
            `Analyze API error: ${analyzeResponse.statusText}`,
        );
      }

      const analysisData = (await analyzeResponse.json()) as AnalyzeApiResponse;

      // Build decision outcome for state machine
      const decision = {
        strategy: analysisData.strategy as InterviewStrategy,
        reason: analysisData.decisionReason,
        confidence: analysisData.confidence,
        shouldEscalate: analysisData.confidence < 50,
        shouldSlowDown: analysisData.confidence > 80,
        nextFocus:
          analysisData.analysis.followupTopics[0] ?? "specific examples",
      };

      // Update state machine and history
      const updatedSessionState = recordInterviewTurn(sessionState, {
        userMessage,
        aiMessage,
        question: aiMessage,
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

      // Check if interview is complete and redirect to report
      if (isInterviewComplete(finalSessionState)) {
        const scenarioInfo =
          SCENARIO_OPTIONS.find((s) => s.value === activeScenarioValue) ||
          SCENARIO_OPTIONS[0];

        const report: Parameters<typeof saveInterviewReportSnapshot>[0] = {
          sessionState: finalSessionState,
          metrics: buildInterviewMetrics({
            analyses: nextAnalysisHistory,
            state: finalSessionState,
          }),
          analyses: nextAnalysisHistory,
          strategyHistory: nextStrategyHistory,
          scenarioTitle: scenarioInfo.title,
          scenarioDescription: scenarioInfo.description,
          personaName: activePersonaConfig.name,
          generatedAt: new Date().toISOString(),
        };

        saveInterviewReportSnapshot(report);

        setTimeout(() => {
          router.push("/simulate/report");
        }, 1000);
      }

      // Reset for next turn
      userTurnKeyRef.current += 1;
    } catch (requestError) {
      const messageText =
        requestError instanceof Error
          ? requestError.message
          : "Unable to reach the API.";
      setError(messageText);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>Initializing Voice Interview...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Setting up speech recognition...
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (setupError) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Card className="w-96 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertCircle className="h-5 w-5" />
              Setup Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-red-800">{setupError}</p>
            <Link href="/simulate/setup?mode=voice">
              <Button variant="outline">Return to Setup</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const editSetupHref = `/simulate/setup?scenario=${activeScenarioValue}`;

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
          <h1 className="text-lg font-semibold">Voice Practice</h1>
          <p className="text-sm text-gray-500">
            {activeScenario.title} • {activePersonaConfig.name}
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
                  Voice interview
                </div>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Adaptive session in progress
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {isRecording && (
                  <Badge
                    variant="destructive"
                    className="h-8 px-3 animate-pulse"
                  >
                    Recording...
                  </Badge>
                )}
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

              {(finalTranscript || interimTranscript) && (
                <div className="text-sm text-slate-500 italic">
                  <span className="font-medium">Hearing:</span>{" "}
                  {finalTranscript}
                  {finalTranscript && interimTranscript ? " " : ""}
                  {interimTranscript}
                </div>
              )}

              {error && (
                <Card className="border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-amber-900 dark:text-amber-200">
                      Note
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      {error}
                    </p>
                  </CardContent>
                </Card>
              )}

              {recordingError && (
                <Card className="border-red-200 bg-red-50/80 dark:border-red-900 dark:bg-red-950/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-red-900 dark:text-red-200">
                      Recording Error
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-red-800 dark:text-red-300">
                      {recordingError}
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

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-slate-200/70 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
            <div className="flex items-center justify-center gap-4">
              {!isRecording ? (
                <Button
                  onClick={handleStartRecording}
                  disabled={isSending}
                  size="lg"
                  className="w-full gap-2"
                >
                  <Mic className="h-5 w-5" />
                  Start Recording
                </Button>
              ) : (
                <Button
                  onClick={handleStopRecording}
                  variant="destructive"
                  size="lg"
                  className="w-full gap-2"
                >
                  <Square className="h-5 w-5" />
                  Stop Recording
                </Button>
              )}
            </div>
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
              Internal interview strategy and decision context for debugging and
              optimization.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <InterviewStatePanel
              state={sessionState}
              stageLabel={stageLabel}
              stageGuidance={stageGuidance}
              lastStrategy={
                lastStrategy ? (lastStrategy as InterviewStrategy) : null
              }
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
