"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Settings2,
  AlertCircle,
} from "lucide-react";

import { ChatMessage } from "@/components/chat/chat-message";
import { InterviewStatePanel } from "@/components/chat/interview-state-panel";
import { LiveFeedbackSidebar } from "@/components/chat/live-feedback-sidebar";
import { VoiceInput } from "@/components/chat/voice-input";
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
import {
  buildLaunchMetaFromSetup,
  buildLoopProgress,
} from "@/lib/session-launch-meta";
import {
  scenarioFromBootstrap,
  useInterviewSessionBootstrap,
} from "@/hooks/use-interview-session-bootstrap";
import {
  appendUniqueTranscript,
  extractSpeakableSentences,
  fetchSpeechToken,
  getSpeechService,
  paceToRatePercent,
  type TranscriptResult,
} from "@/lib/speechService";
import { consumeChatStream } from "@/lib/chat-stream";
import {
  analyzeDelivery,
  describeDelivery,
  type PhraseTiming,
} from "@/lib/speech-metrics";

const RESPONSE_TIME_LIMIT_SECONDS = 35;

type DisplayMessage = {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
  /** Voice delivery summary (pace, fillers, pauses) for user turns. */
  delivery?: string | null;
};

type ChatApiResponse = {
  aiMessage: string;
  turnCount: number;
  summary: string | null;
  // The chat route analyzes the answer inline and returns the verdict, so the
  // voice client no longer makes a separate /api/analyze call.
  analysis: AnalysisResult | null;
  strategy: InterviewStrategy | null;
  decisionReason: string | null;
  confidence: number | null;
  followupSummary: string | null;
  error?: string;
  details?: string;
};

const DEFAULT_SETUP = createDefaultInterviewSetup();

function getCurrentTimestamp() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createSessionId(): string {
  return `voice-session-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
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

function VoiceLoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <Card className="w-96">
        <CardHeader>
          <CardTitle>Initializing voice interview...</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600">
            Setting up Azure speech recognition and synthesis.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VoiceSimulatePage() {
  return (
    <Suspense fallback={<VoiceLoadingFallback />}>
      <VoiceSimulateInner />
    </Suspense>
  );
}

function VoiceSimulateInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bootstrap = useInterviewSessionBootstrap(searchParams, "voice");

  const [tokenStatus, setTokenStatus] = useState<
    "idle" | "fetching" | "ready" | "error"
  >("idle");
  const [tokenError, setTokenError] = useState<string | null>(null);

  const activePersonaConfig = bootstrap.personaConfig;
  const activeScenarioValue = bootstrap.scenarioValue;
  const [voiceConfig, setVoiceConfig] = useState(DEFAULT_SETUP.voiceConfig);
  const [messagesHydrated, setMessagesHydrated] = useState(false);

  const isLoading =
    bootstrap.status === "loading" ||
    !messagesHydrated ||
    (bootstrap.status === "ready" && tokenStatus === "fetching");
  const setupError = bootstrap.error ?? tokenError;

  const [sessionState, setSessionState] = useState<InterviewSessionState>(() =>
    createInterviewSessionState(
      bootstrap.sessionId ?? createSessionId(),
      bootstrap.personaConfig.name,
    ),
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

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [isSpeakingTts, setIsSpeakingTts] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const speechServiceRef = useRef(getSpeechService());
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const transcriptBufferRef = useRef("");
  const phraseTimingsRef = useRef<PhraseTiming[]>([]);
  const isStoppingRef = useRef(false);
  const openingGeneratedRef = useRef(false);
  const isMountedRef = useRef(true);
  const voiceConfigRef = useRef(voiceConfig);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    voiceConfigRef.current = voiceConfig;
  }, [voiceConfig]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const [showLiveCoaching, setShowLiveCoaching] = useState(true);
  const [isAdvancedStateOpen, setIsAdvancedStateOpen] = useState(false);
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  const activeScenario = scenarioFromBootstrap(bootstrap);
  const stageLabel = getStageLabel(sessionState.currentStage);
  const metricTone = getMetricTone(liveMetrics);

  useEffect(() => {
    if (bootstrap.status === "redirect-setup") {
      router.replace("/simulate/setup?mode=voice");
    } else if (bootstrap.status === "redirect-voice") {
      router.replace("/simulate/chat");
    }
  }, [bootstrap.status, router]);

  useEffect(() => {
    if (bootstrap.status === "ready") {
      setVoiceConfig(bootstrap.voiceConfig);
    }
  }, [bootstrap.status, bootstrap.voiceConfig]);

  useEffect(() => {
    if (bootstrap.sessionId) {
      setSessionState((current) => ({
        ...current,
        sessionId: bootstrap.sessionId!,
      }));
    }
  }, [bootstrap.sessionId]);

  useEffect(() => {
    if (bootstrap.status !== "ready") return;
    saveInterviewSetup({
      scenarioValue: activeScenarioValue,
      customScenarioBrief: bootstrap.customScenarioBrief,
      streamResponses: bootstrap.streamResponses,
      liveCoachingEnabled: bootstrap.liveCoachingEnabled,
      personaConfig: activePersonaConfig,
      practiceMode: "voice",
      interviewLoop: bootstrap.interviewLoop,
      voiceConfig: bootstrap.voiceConfig,
      jobDescription: DEFAULT_SETUP.jobDescription,
      resume: DEFAULT_SETUP.resume,
    });
  }, [
    bootstrap.status,
    activeScenarioValue,
    bootstrap.customScenarioBrief,
    bootstrap.streamResponses,
    bootstrap.liveCoachingEnabled,
    bootstrap.interviewLoop,
    activePersonaConfig,
    bootstrap.voiceConfig,
  ]);

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
          if (restored.length > 0) {
            setMessages(restored);
            openingGeneratedRef.current = true;
          }
        } catch {
          // fresh opening will be generated
        } finally {
          if (!cancelled) setMessagesHydrated(true);
        }
      };
      queueMicrotask(() => void hydrate());
      return () => {
        cancelled = true;
      };
    }

    setMessagesHydrated(true);
  }, [
    bootstrap.status,
    bootstrap.sessionId,
    messagesHydrated,
    searchParams,
  ]);

  useEffect(() => {
    if (bootstrap.status !== "ready") {
      return;
    }

    setTokenStatus("fetching");
    const speechService = speechServiceRef.current;
    let cancelled = false;

    void (async () => {
      try {
        const tokenResponse = await fetchSpeechToken();
        if (cancelled) return;
        speechService.initialize({
          authorizationToken: tokenResponse.token,
          region: tokenResponse.region,
          expiresAt: Date.now() + tokenResponse.expiresInSeconds * 1000,
        });
        setTokenStatus("ready");
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error
            ? error.message
            : "Failed to initialize speech service.";
        setTokenError(message);
        setTokenStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [bootstrap.status]);

  // Auto-scroll messages.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Single unmount-only cleanup. Stops in-flight TTS and recognition so the
  // interviewer voice does not bleed into other pages. We capture the
  // speechService instance up-front so the cleanup function does not depend
  // on the ref's value at unmount time.
  useEffect(() => {
    isMountedRef.current = true;
    const speechService = speechServiceRef.current;

    const handleBeforeUnload = () => {
      try {
        speechService.cleanup();
      } catch {
        // ignore
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener("beforeunload", handleBeforeUnload);
    }

    return () => {
      isMountedRef.current = false;

      if (typeof window !== "undefined") {
        window.removeEventListener("beforeunload", handleBeforeUnload);
      }

      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }

      // Synchronously tear everything down. cleanup() handles the recognizer,
      // synthesizer, and any audio that has already been buffered to the
      // speaker.
      try {
        speechService.cleanup();
      } catch (cleanupError) {
        console.warn("Speech service cleanup error:", cleanupError);
      }

      // As a safety net, also cancel browser-native speech synthesis in case
      // the user's environment falls back to it.
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const speakAiMessage = async (message: string) => {
    if (!voiceConfigRef.current?.ttsEnabled) {
      return;
    }

    const speechService = speechServiceRef.current;

    setIsSpeakingTts(true);
    try {
      await speechService.speak(
        message,
        voiceConfigRef.current.selectedVoiceUri,
        { ratePercent: paceToRatePercent(activePersonaConfig.pace) },
      );
    } catch (ttsError) {
      console.warn("TTS failed:", ttsError);
    } finally {
      if (isMountedRef.current) {
        setIsSpeakingTts(false);
      }
    }
  };

  const stopTts = () => {
    const speechService = speechServiceRef.current;
    void speechService.stopSpeaking();
    setIsSpeakingTts(false);
  };

  // Generate an opening greeting once setup is loaded.
  useEffect(() => {
    if (
      bootstrap.status !== "ready" ||
      !messagesHydrated ||
      isLoading ||
      setupError ||
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
        if (!bootstrap.sessionId) return;

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: bootstrap.sessionId,
            mode: "opening",
            streamResponse: false,
          }),
        });

        if (!response.ok) {
          console.warn("Failed to generate opening greeting");
          return;
        }

        const data = (await response.json()) as ChatApiResponse;

        if (!isMountedRef.current) {
          return;
        }

        const openingMessage: DisplayMessage = {
          id: `msg-${Date.now()}-opening`,
          role: "ai",
          content: data.aiMessage,
          timestamp: getCurrentTimestamp(),
        };

        setMessages([openingMessage]);

        await speakAiMessage(data.aiMessage);
      } catch (err) {
        console.warn("Error generating opening greeting:", err);
      }
    };

    void generateOpening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, setupError, activePersonaConfig, activeScenarioValue]);

  const handleStartRecording = async () => {
    const speechService = speechServiceRef.current;

    if (!speechService.isInitialized()) {
      setRecordingError("Speech service not initialized.");
      return;
    }

    // Stop any AI voice still playing so we do not record the speaker output.
    if (speechService.isSpeaking()) {
      await speechService.stopSpeaking();
      setIsSpeakingTts(false);
    }

    try {
      setRecordingError(null);
      setFinalTranscript("");
      setInterimTranscript("");
      transcriptBufferRef.current = "";
      phraseTimingsRef.current = [];
      isStoppingRef.current = false;
      setIsRecording(true);

      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
      }

      recordingTimeoutRef.current = setTimeout(() => {
        void handleStopRecording();
      }, RESPONSE_TIME_LIMIT_SECONDS * 1000);

      await speechService.startListening(
        (result: TranscriptResult) => {
          if (!isMountedRef.current) {
            return;
          }

          if (result.final) {
            const finalText = result.final.trim();

            if (finalText) {
              transcriptBufferRef.current = appendUniqueTranscript(
                transcriptBufferRef.current,
                finalText,
              );
              setFinalTranscript(transcriptBufferRef.current);

              if (
                typeof result.offsetSeconds === "number" &&
                typeof result.durationSeconds === "number"
              ) {
                phraseTimingsRef.current.push({
                  text: finalText,
                  offsetSeconds: result.offsetSeconds,
                  durationSeconds: result.durationSeconds,
                });
              }
            }

            setInterimTranscript("");
          } else if (result.interim) {
            setInterimTranscript(result.interim);
          }
        },
        (errorMsg: string) => {
          if (!isMountedRef.current) return;

          setRecordingError(errorMsg);
          setIsRecording(false);
          if (recordingTimeoutRef.current) {
            clearTimeout(recordingTimeoutRef.current);
            recordingTimeoutRef.current = null;
          }
        },
        {
          // Bias recognition toward role/scenario-specific terms.
          phraseList: [
            activePersonaConfig.name,
            activePersonaConfig.seniority,
            activePersonaConfig.industry,
            bootstrap.jobDescriptionTitle ?? "",
            activeScenario.title,
          ].filter((term): term is string => Boolean(term && term.trim())),
        },
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Recording failed.";
      setRecordingError(errorMessage);
      setIsRecording(false);
      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
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

      if (!isMountedRef.current) {
        return;
      }

      setIsRecording(false);

      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }

      const combinedTranscript = appendUniqueTranscript(
        transcriptBufferRef.current,
        interimTranscript,
      );

      const delivery = analyzeDelivery(
        combinedTranscript,
        phraseTimingsRef.current,
      );
      const deliveryNote = combinedTranscript ? describeDelivery(delivery) : null;

      transcriptBufferRef.current = "";
      phraseTimingsRef.current = [];
      setFinalTranscript("");
      setInterimTranscript("");

      if (combinedTranscript) {
        await handleSubmitTranscript(combinedTranscript, deliveryNote);
      } else {
        setRecordingError("No speech detected. Please try again.");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to stop recording.";
      if (isMountedRef.current) {
        setRecordingError(errorMessage);
      }
    } finally {
      isStoppingRef.current = false;
    }
  };

  const handleSubmitTranscript = async (
    transcript: string,
    deliveryNote?: string | null,
  ) => {
    if (!transcript.trim()) {
      setRecordingError("No speech detected. Please try again.");
      return;
    }

    await handleSend(transcript, deliveryNote);
  };

  const handleSend = async (
    userMessage: string,
    deliveryNote?: string | null,
  ) => {
    if (isSending) return;

    if (!bootstrap.sessionId) {
      setError(
        "This session is not connected to the database. Please start a new interview from the setup page.",
      );
      return;
    }

    try {
      setError(null);
      setIsSending(true);

      const userMessageId = `msg-${Date.now()}-user`;

      setMessages((prev) => [
        ...prev,
        {
          id: userMessageId,
          role: "user",
          content: userMessage,
          timestamp: getCurrentTimestamp(),
          delivery: deliveryNote ?? null,
        },
      ]);

      // Stream the reply so the interviewer can start speaking sentence-by-
      // sentence while the rest of the answer is still being generated. This
      // cuts perceived latency dramatically versus waiting for the full reply.
      const aiMessageId = `msg-${Date.now()}-ai`;
      setMessages((prev) => [
        ...prev,
        {
          id: aiMessageId,
          role: "ai",
          content: "",
          timestamp: getCurrentTimestamp(),
        },
      ]);

      const speechService = speechServiceRef.current;
      const ttsEnabled = Boolean(voiceConfigRef.current?.ttsEnabled);
      const prosody = {
        ratePercent: paceToRatePercent(activePersonaConfig.pace),
      };
      let ttsBuffer = "";
      let startedSpeaking = false;
      let lastSpeak: Promise<void> = Promise.resolve();

      const enqueueSentences = (flush: boolean) => {
        if (!ttsEnabled) return;
        const { sentences, rest } = extractSpeakableSentences(ttsBuffer, {
          flush,
        });
        ttsBuffer = rest;
        for (const sentence of sentences) {
          if (!startedSpeaking) {
            startedSpeaking = true;
            setIsSpeakingTts(true);
          }
          lastSpeak = speechService.speakQueued(
            sentence,
            voiceConfigRef.current?.selectedVoiceUri,
            prosody,
          );
        }
      };

      const chatResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: bootstrap.sessionId,
          userMessage,
          streamResponse: true,
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

      let result: ChatApiResponse;
      try {
        result = await consumeChatStream<ChatApiResponse>(
          chatResponse,
          (chunk) => {
            ttsBuffer += chunk;
            if (isMountedRef.current) {
              setMessages((prev) =>
                prev.map((item) =>
                  item.id === aiMessageId
                    ? { ...item, content: `${item.content}${chunk}` }
                    : item,
                ),
              );
            }
            enqueueSentences(false);
          },
        );
      } catch {
        // Streaming failed mid-flight; fall back to a non-streamed request so
        // the user still gets a reply.
        const fallback = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: bootstrap.sessionId,
            userMessage,
            streamResponse: false,
          }),
        });
        if (!fallback.ok) {
          throw new Error("Failed to generate AI response.");
        }
        result = (await fallback.json()) as ChatApiResponse;
        ttsBuffer = result.aiMessage;
      }

      const aiMessage = result.aiMessage;

      // Speak any trailing partial sentence and reconcile the bubble with the
      // authoritative final text.
      enqueueSentences(true);
      if (isMountedRef.current) {
        setMessages((prev) =>
          prev.map((item) =>
            item.id === aiMessageId ? { ...item, content: aiMessage } : item,
          ),
        );
      }

      // Clear the speaking indicator once the queued audio finishes.
      if (startedSpeaking) {
        void lastSpeak.finally(() => {
          if (isMountedRef.current && !speechService.isSpeaking()) {
            setIsSpeakingTts(false);
          }
        });
      }

      if (!isMountedRef.current) {
        return;
      }

      // Trivial answers come back with analysis null — skip scored bookkeeping.
      if (!result.analysis || !result.strategy) {
        return;
      }

      const analysisResult = result.analysis;
      const turnStrategy = result.strategy;
      const turnConfidence = result.confidence ?? 50;

      const decision = {
        strategy: turnStrategy,
        reason: result.decisionReason ?? "",
        confidence: turnConfidence,
        shouldEscalate: turnConfidence < 50,
        shouldSlowDown: turnConfidence > 80,
        nextFocus: analysisResult.followupTopics[0] ?? "specific examples",
      };

      const updatedSessionState = recordInterviewTurn(sessionState, {
        userMessage,
        aiMessage,
        question: aiMessage,
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
      setLiveMetrics(
        buildInterviewMetrics({
          analyses: nextAnalysisHistory,
          state: finalSessionState,
        }),
      );
      setLastFollowupPrompt(result.followupSummary);
      setLastDecisionReason(result.decisionReason ?? "");
      setLastStrategy(turnStrategy);
      setLastDecisionConfidence(turnConfidence);

      if (isInterviewComplete(finalSessionState)) {
        const finalMetrics = buildInterviewMetrics({
          analyses: nextAnalysisHistory,
          state: finalSessionState,
        });
        const snapshot: InterviewReportSnapshot = {
          sessionState: finalSessionState,
          metrics: finalMetrics,
          analyses: nextAnalysisHistory,
          strategyHistory: nextStrategyHistory,
          scenarioTitle: activeScenario.title,
          scenarioDescription: activeScenario.description,
          personaName: activePersonaConfig.name,
          generatedAt: new Date().toISOString(),
          jobDescription: bootstrap.jobDescriptionRef,
        };

        const sessionId = bootstrap.sessionId;
        if (sessionId) {
          const averageScore = computeAverageScore(snapshot);
          const startedAtMs = Date.parse(sessionState.createdAt);
          const durationMinutes = Number.isFinite(startedAtMs)
            ? Math.max(1, Math.round((Date.now() - startedAtMs) / 60000))
            : null;
          void fetch(`/api/sessions/${sessionId}`, {
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
            // ignore; report page reads from Supabase
          });
        }

        setTimeout(() => {
          if (isMountedRef.current) {
            router.push(
              sessionId ? `/simulate/report/${sessionId}` : "/dashboard",
            );
          }
        }, 1000);
      }
    } catch (requestError) {
      const messageText =
        requestError instanceof Error
          ? requestError.message
          : "Unable to reach the API.";
      if (isMountedRef.current) {
        setError(messageText);
      }
    } finally {
      if (isMountedRef.current) {
        setIsSending(false);
      }
    }
  };

  if (bootstrap.status === "loading" || !messagesHydrated) {
    return <VoiceLoadingFallback />;
  }

  if (bootstrap.status === "error") {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 px-6">
        <Card className="max-w-md border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertCircle className="h-5 w-5" />
              Could not open session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-red-800">
              {bootstrap.error ?? "This session could not be resumed."}
            </p>
            <Link href="/simulate/setup?mode=voice">
              <Button variant="outline">Return to setup</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <VoiceLoadingFallback />;
  }

  if (setupError) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Card className="w-96 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-900">
              <AlertCircle className="h-5 w-5" />
              Setup error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-red-800">{setupError}</p>
            <Link href="/simulate/setup?mode=voice">
              <Button variant="outline">Return to setup</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const editSetupHref = `/simulate/setup?scenario=${activeScenarioValue}&mode=voice`;

  const handleNavigateAway = () => {
    // Stop any in-flight TTS immediately so it does not continue playing on
    // the next page even before unmount cleanup runs.
    const speechService = speechServiceRef.current;
    try {
      void speechService.stopSpeaking();
      if (isRecordingRef.current) {
        void speechService.stopListening();
      }
    } catch {
      // ignore
    }
    setIsSpeakingTts(false);
  };

  const handleEndSession = async () => {
    if (isEnding) return;
    setIsEnding(true);
    handleNavigateAway();
    const sessionId = bootstrap.sessionId;
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
        jobDescription: bootstrap.jobDescriptionRef,
      };
      const averageScore = computeAverageScore(completedSnapshot);
      try {
        const launchMeta = buildLaunchMetaFromSetup({
          scenarioValue: activeScenarioValue,
          customScenarioBrief: bootstrap.customScenarioBrief,
          streamResponses: bootstrap.streamResponses,
          liveCoachingEnabled: bootstrap.liveCoachingEnabled,
          personaConfig: activePersonaConfig,
          practiceMode: "voice",
          interviewLoop: bootstrap.interviewLoop,
          voiceConfig: bootstrap.voiceConfig,
          jobDescription: DEFAULT_SETUP.jobDescription,
          resume: DEFAULT_SETUP.resume,
        });
        const loop = buildLoopProgress(launchMeta, sessionId);
        await fetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "completed",
            averageScore,
            durationMinutes,
            metrics: {
              ...finalMetrics,
              launch: launchMeta,
              loop,
            },
            endedAt: new Date().toISOString(),
          }),
        });
      } catch {
        // best-effort
      }
      router.push(`/simulate/report/${sessionId}`);
    } else {
      router.push("/dashboard");
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="h-16 bg-white border-b border-gray-200/80 flex items-center px-6 gap-4 shadow-soft">
        <Link href="/dashboard" onClick={handleNavigateAway}>
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-gray-100 transition-colors duration-150"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold">Voice practice</h1>
          <p className="text-sm text-gray-500 truncate">
            {activeScenario.title} • {activePersonaConfig.name} •{" "}
            {voiceConfig.ttsEnabled ? "TTS on" : "TTS off"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {bootstrap.jobDescriptionTitle && (
            <span
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
              title={bootstrap.jobDescriptionTitle}
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="max-w-[160px] truncate">
                {bootstrap.jobDescriptionTitle}
              </span>
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="shadow-soft-sm">
                <Settings2 className="h-4 w-4" />
                <span className="sr-only">Open settings</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                onSelect={() => {
                  handleNavigateAway();
                  router.push(editSetupHref);
                }}
              >
                Edit setup
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
              We&apos;ll stop the interviewer voice, finalize the transcript,
              and generate the feedback report. Once a session is ended you
              can&apos;t resume it — start a fresh practice when you&apos;re
              ready.
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
                {isSpeakingTts && (
                  <>
                    <Badge
                      variant="secondary"
                      className="h-8 gap-1.5 px-3 text-blue-700 bg-blue-100"
                    >
                      <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                      Interviewer speaking
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={() => void stopTts()}
                    >
                      Stop voice
                    </Button>
                  </>
                )}
                {isRecording && (
                  <Badge
                    variant="destructive"
                    className="h-8 gap-1.5 px-3"
                  >
                    <span className="relative flex h-2 w-2 items-center justify-center">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                    </span>
                    Recording
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
                  deliveryNote={msg.delivery}
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

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-slate-200/70 bg-white/80 p-4 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
            <VoiceInput
              isRecording={isRecording}
              isProcessing={isSending}
              isSpeakingTts={isSpeakingTts}
              interimTranscript={interimTranscript}
              finalTranscript={finalTranscript}
              recordingError={recordingError}
              timeLimitSeconds={RESPONSE_TIME_LIMIT_SECONDS}
              onStart={() => void handleStartRecording()}
              onStop={() => void handleStopRecording()}
              onStopTts={stopTts}
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
              Internal interview strategy and decision context for debugging
              and optimization.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <InterviewStatePanel
              state={sessionState}
              stageLabel={stageLabel}
              stageGuidance=""
              lastStrategy={lastStrategy}
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
