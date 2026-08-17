"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Settings2,
  AlertCircle,
  Code2,
  Mic,
  Volume2,
} from "lucide-react";

import { ChatMessage } from "@/components/chat/chat-message";
import { InterviewStatePanel } from "@/components/chat/interview-state-panel";
import { VoiceInput } from "@/components/chat/voice-input";
import { VoiceLoadingFallback } from "./voice-loading";
import { useInterviewTurnState } from "@/hooks/use-interview-turn-state";
import { useResumedSession } from "@/hooks/use-resumed-session";
import { useTranscriptAutoscroll } from "@/hooks/use-transcript-autoscroll";
import { CoachingRail } from "@/components/chat/coaching-rail";
import { JobDescriptionChip } from "@/components/chat/job-description-chip";
import {
  NO_RESPONSE_MESSAGE,
  type ChatTurnResponse,
} from "@/lib/chat-contract";
import {
  formatMessageTime,
  getMetricTone,
  getStageGuidance,
  getStageLabel,
} from "@/lib/interview-stage-labels";
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
  createDefaultInterviewSetup,
  updateInterviewSetup,
} from "@/lib/interview-setup";
import {
  scenarioFromBootstrap,
  useInterviewSessionBootstrap,
} from "@/hooks/use-interview-session-bootstrap";
import {
  extractSpeakableSentences,
  getSpeechService,
  paceToRatePercent,
} from "@/lib/speech-service";
import { useSpeechAnswer } from "@/hooks/use-speech-answer";
import { CodeInput } from "@/components/chat/code-input";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { DEFAULT_CODE_LANGUAGE, type CodeLanguage } from "@/lib/code-answer";
import { ROUND_TYPE_SPECS, supportsCodeEditor } from "@/lib/round-types";
import { readJson } from "@/lib/api/fetch-json";
import { consumeChatStream } from "@/lib/chat-stream";
import { recoverPersistedTurn } from "@/lib/chat-recovery";
import { targetTurnsForRound } from "@/lib/interview-progress";
import type { MicroFeedbackTone } from "@/lib/micro-feedback";

const RESPONSE_TIME_LIMIT_SECONDS = 180; // 3 minutes per answer
/** Retries of the opening greeting before the error is left standing. */
const MAX_OPENING_ATTEMPTS = 2;

type DisplayMessage = {
  id: string;
  role: "user" | "ai";
  content: string;
  timestamp: string;
  /** Voice delivery summary (pace, fillers, pauses) for user turns. */
  delivery?: string | null;
  /**
   * Coaching hint for the user's turn. The server has always returned this;
   * voice used to drop it because its local copy of the response type had
   * drifted and omitted the field.
   */
  feedbackHint?: string | null;
  feedbackTone?: MicroFeedbackTone;
};

const DEFAULT_SETUP = createDefaultInterviewSetup();

/**
 * The voice interview screen.
 *
 * Loaded by `./page.tsx` through `next/dynamic` with `ssr: false`, so it — and
 * the Azure Speech SDK it pulls in — never enters the server-render graph. The
 * page cannot render without a microphone and speaker, and on the server the
 * SDK resolves its Node-only certificate-checking path.
 */
export default function VoiceSession() {
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

  const activePersonaConfig = bootstrap.personaConfig;
  const activeScenarioValue = bootstrap.scenarioValue;
  /**
   * Purely derived. This was `useState` seeded with the default plus an effect
   * copying `bootstrap.voiceConfig` in once it loaded — but nothing else ever
   * called the setter, so the state was never independent of the prop. Two
   * renders and a stale first paint to hold a value that was always a function
   * of the bootstrap.
   */
  const voiceConfig =
    bootstrap.status === "ready"
      ? bootstrap.voiceConfig
      : DEFAULT_SETUP.voiceConfig;
  const [messagesHydrated, setMessagesHydrated] = useState(false);

  // Declared up here, not beside `stageLabel` below, because the recognition
  // hook biases the recognizer toward the scenario title.
  const activeScenario = scenarioFromBootstrap(bootstrap);

  const resumed = useResumedSession(bootstrap);
  const activeRound =
    bootstrap.interviewLoop.rounds[bootstrap.interviewLoop.currentRoundIndex];
  const turn = useInterviewTurnState({
    sessionId: bootstrap.sessionId,
    personaName: bootstrap.personaConfig.name,
    targetTurns: targetTurnsForRound(activeRound),
    initialAnalyses: resumed.analyses,
    initialDecision: resumed.lastDecision,
  });

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const [isSpeakingTts, setIsSpeakingTts] = useState(false);

  /**
   * Whether this turn is being typed as code rather than spoken.
   *
   * A voice technical round is still a spoken round — the interviewer states
   * the problem and the candidate thinks out loud — but the answer to "write
   * the function" cannot be dictated, and the rubric scores `correctness`,
   * `complexity` and `codeQuality` regardless of which mode the round is in.
   *
   * Per turn, not per round, and mutually exclusive with the microphone: one
   * answer has one format, exactly as the text screen already behaves.
   */
  const [isWritingCode, setIsWritingCode] = useState(false);
  const isWritingCodeRef = useRef(false);
  const [codeLanguage, setCodeLanguage] = useState<CodeLanguage>(
    ROUND_TYPE_SPECS[activeRound?.type ?? "technical_swe"].defaults.language ??
      DEFAULT_CODE_LANGUAGE,
  );

  /**
   * The same singleton the recognition hook holds, kept here for TTS.
   *
   * `getSpeechService()` is a process-wide instance and `useSpeechAnswer`
   * initialises it with the token, so speaking and listening share one
   * configured service without either side owning the other.
   */
  const speechServiceRef = useRef(getSpeechService());
  const openingGeneratedRef = useRef(false);
  const isMountedRef = useRef(true);
  const voiceConfigRef = useRef(voiceConfig);
  const sessionCompleteRef = useRef(false);
  /**
   * Set by `onPlaybackError` for the duration of one `speakAiMessage` call.
   *
   * The queue path detects a blocked or dead playback and reports it, but it
   * reports it *out of band* — the speak promise still resolves. Without this
   * flag the caller cannot tell a message that was read aloud from one that
   * was silently swallowed, which is the whole reason the opening greeting
   * failed unnoticed.
   */
  const playbackFailedRef = useRef(false);
  /**
   * The greeting the browser refused to play, kept so a tap can replay it.
   *
   * Autoplay needs a user gesture, and the opening greeting is the first audio
   * in the document — fired from an effect after an `await`, with nothing on
   * the stack that counts. Entering via the setup wizard carries sticky
   * activation from the microphone-check click, which is why this only bites
   * on a reload, a bookmark or a shared `?session=` link.
   */
  const [blockedAudioMessage, setBlockedAudioMessage] = useState<string | null>(
    null,
  );

  /**
   * The microphone, the transcript and the delivery metrics.
   *
   * `onComplete` fires for a click, a long pause and the response timeout
   * alike, which is why the three used to need `handleStopRecordingRef`: the
   * latter two run from closures armed when recording started. The hook keeps
   * the callback in a ref refreshed every render, so all three now reach the
   * same current `handleSubmitTranscript`.
   */
  const speech = useSpeechAnswer({
    enabled: bootstrap.status === "ready",
    timeLimitSeconds: RESPONSE_TIME_LIMIT_SECONDS,
    phraseList: [
      activePersonaConfig.name,
      activePersonaConfig.seniority,
      activePersonaConfig.industry,
      bootstrap.jobDescriptionTitle ?? "",
      activeScenario.title,
    ],
    onComplete: async ({ transcript, deliveryNote }) => {
      if (transcript) {
        await handleSubmitTranscript(transcript, deliveryNote);
        return;
      }
      /**
       * Three minutes elapsed and nothing was said.
       *
       * This used to set "No speech detected" and stop, which left the session
       * with a closed microphone, no interviewer turn pending and nothing to
       * click — a dead end reachable by walking away from the screen.
       * Submitting the same placeholder the text screen uses keeps the
       * interview moving and makes the silence a scored event rather than a
       * stuck page.
       */
      speech.setRecordingError(null);
      await handleSend(NO_RESPONSE_MESSAGE);
    },
  });

  // Named locals for the members used all over this file. `setRecordingError`
  // is a `useState` setter and so referentially stable, which is what lets it
  // sit in an effect's dependency list without re-running it.
  const { setRecordingError } = speech;

  // Below the hook, since both halves of this now come from it.
  const isLoading =
    bootstrap.status === "loading" ||
    !messagesHydrated ||
    (bootstrap.status === "ready" && speech.tokenStatus === "fetching");
  const setupError = bootstrap.error ?? speech.tokenError;

  useEffect(() => {
    voiceConfigRef.current = voiceConfig;
  }, [voiceConfig]);

  useEffect(() => {
    isWritingCodeRef.current = isWritingCode;
  }, [isWritingCode]);

  useEffect(() => {
    sessionCompleteRef.current = turn.stage === "report";
  }, [turn.stage]);

  const [showLiveCoaching, setShowLiveCoaching] = useState(true);
  const [isAdvancedStateOpen, setIsAdvancedStateOpen] = useState(false);
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  /**
   * Bumped when the opening greeting fails, to re-run the effect that makes it.
   * Bounded, because a server that is down should not be retried forever.
   */
  const [openingAttempt, setOpeningAttempt] = useState(0);

  const stageLabel = getStageLabel(turn.stage);
  const metricTone = getMetricTone(turn.metrics);

  useEffect(() => {
    if (bootstrap.status === "redirect-setup") {
      router.replace("/simulate/setup?mode=voice");
    } else if (bootstrap.status === "redirect-voice") {
      router.replace("/simulate/chat");
    }
  }, [bootstrap.status, router]);

  useEffect(() => {
    if (bootstrap.status !== "ready") return;
    updateInterviewSetup({
      scenarioValue: activeScenarioValue,
      customScenarioBrief: bootstrap.customScenarioBrief,
      streamResponses: bootstrap.streamResponses,
      liveCoachingEnabled: bootstrap.liveCoachingEnabled,
      personaConfig: activePersonaConfig,
      practiceMode: "voice",
      interviewLoop: bootstrap.interviewLoop,
      voiceConfig: bootstrap.voiceConfig,
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

  // The transcript arrives with the bootstrap; this maps it into display
  // messages. It also restores the scoring history, which the old copy of this
  // effect did not.
  useEffect(() => {
    if (bootstrap.status !== "ready" || messagesHydrated) return;
    if (resumed.status === "loading") return;

    if (resumed.messages.length > 0) {
      // One-time hydration from server data; guarded by `messagesHydrated`.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessages(
        resumed.messages.map((row) => ({
          id: row.id,
          role: row.role === "user" ? "user" : "ai",
          content: row.content,
          timestamp: formatMessageTime(new Date(row.createdAt)),
        })),
      );
      // A resumed session already has its opening turn.
      openingGeneratedRef.current = true;
    }
    setMessagesHydrated(true);
  }, [bootstrap.status, messagesHydrated, resumed.status, resumed.messages]);

  /**
   * TTS failures only. Token minting and renewal moved into `useSpeechAnswer`,
   * which the microphone and the synthesizer share — they are configured off
   * one `initialize()` on one singleton, so a lapsed token still stops both,
   * and `speech.tokenError` still replaces the screen when it does.
   *
   * These are recoverable — the interview continues in text — so they go to
   * the inline slot rather than replacing the screen.
   */
  useEffect(() => {
    if (bootstrap.status !== "ready") return;

    const speechService = speechServiceRef.current;
    let cancelled = false;

    speechService.onPlaybackError((message) => {
      // Recorded even when the effect has been torn down: `speakAiMessage`
      // reads this synchronously after its await and must not conclude that
      // silence was a successful read.
      playbackFailedRef.current = true;
      if (cancelled) return;
      setRecordingError(message);
    });

    return () => {
      cancelled = true;
      speechService.onPlaybackError(null);
    };
  }, [bootstrap.status, setRecordingError]);

  // Auto-scroll messages. See the hook for why this is not simply "scroll
  // smoothly whenever `messages` changes".
  const messagesEndRef = useTranscriptAutoscroll(messages);

  /**
   * Liveness only.
   *
   * Tearing down the speech service — the recognizer, the synthesizer, the
   * buffered speaker audio, the `beforeunload` handler and the native-synthesis
   * safety net — is `useSpeechAnswer`'s unmount cleanup now. Doing it in both
   * places would be two `cleanup()` calls on one singleton, and the second
   * would be operating on an already-disposed recognizer.
   */
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Speak one complete message, and report whether it was actually heard.
   *
   * This used to call the one-shot `speak()`, which is why the opening greeting
   * was silent while every later reply was fine — they were two different
   * implementations, and only the queue path was ever fixed. The one-shot path
   * never closed its `SpeakerAudioDestination` while the audio element was
   * live, so its sole completion signal was a safety timer: a blocked `play()`
   * and a clean read were indistinguishable to the caller. It also never routed
   * anything to `reportPlaybackFailure`, so nothing reached the screen either.
   *
   * The queue path closes the destination itself, polls for real playback
   * progress and reports failure — see `waitForQueuePlaybackEnd` in
   * `speech-service.ts`. Using it here means the greeting gets the same
   * guarantees as the rest of the interview.
   *
   * Returns `false` when the audio did not play, so the caller can offer a tap
   * to retry instead of opening the microphone on a question nobody heard.
   */
  const speakAiMessage = async (message: string): Promise<boolean> => {
    // TTS off by choice is not a failure; the interview proceeds in text.
    if (!voiceConfigRef.current?.ttsEnabled) {
      return true;
    }

    const speechService = speechServiceRef.current;
    // `flush: true` because the whole message is already in hand — there is no
    // partial tail to carry, unlike the streaming path.
    const { sentences } = extractSpeakableSentences(message, { flush: true });
    const utterances = sentences.length > 0 ? sentences : [message.trim()];

    playbackFailedRef.current = false;
    setIsSpeakingTts(true);
    try {
      // Fed without awaiting each in turn: `speakQueued` enqueues synchronously
      // so order is preserved, and letting Azure synthesize sentence N+1 while
      // N is audible is what keeps the gaps out.
      const settled = await Promise.allSettled(
        utterances.map((sentence) =>
          speechService.speakQueued(
            sentence,
            voiceConfigRef.current.selectedVoiceUri,
            { ratePercent: paceToRatePercent(activePersonaConfig.pace) },
          ),
        ),
      );

      await speechService.waitForQueuedPlayback();

      const rejected = settled.find((result) => result.status === "rejected");
      if (rejected) {
        console.warn("TTS synthesis failed:", rejected.reason);
        return false;
      }

      return !playbackFailedRef.current;
    } catch (ttsError) {
      console.warn("TTS failed:", ttsError);
      return false;
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

  /**
   * Declared above the effect that calls it. It used to sit below, which is
   * safe at runtime — the effect body runs after the component body has
   * evaluated the const — but read as a use-before-declaration, and lint
   * flagged it as one. Ordering it properly costs nothing.
   */
  /**
   * Open the microphone, and take the "Speaking" badge down with it.
   *
   * `speech.start()` stops in-flight TTS itself so the speaker output is not
   * recorded, but it has no way to clear this page's `isSpeakingTts` — so
   * without this the header kept offering "Stop voice" for audio that had
   * already been cut. `stopTts` is both halves and is a no-op when nothing is
   * playing, which is the usual case: the auto-start path runs *after* the
   * interviewer has finished.
   */
  const startAnswering = async () => {
    if (speech.isBusy()) return;
    stopTts();
    await speech.start();
  };

  const tryAutoStartRecording = async () => {
    if (!isMountedRef.current) return;
    if (speech.isBusy()) return;
    if (sessionCompleteRef.current) return;
    // The candidate is typing. Reopening the microphone here would record the
    // room over an answer they are writing, and the silence watch would then
    // auto-submit an empty transcript on their behalf.
    if (isWritingCodeRef.current) return;

    // `speech.start` reports a lapsed token itself, on the same inline slot.
    // Returning quietly used to leave the interview looking finished:
    // interviewer done speaking, microphone never opening, nothing on screen
    // to explain it or to click.
    await startAnswering();
  };

  /**
   * Replay a message the browser refused to autoplay.
   *
   * The click is the entire mechanism: it grants the document sticky user
   * activation, so this attempt and every utterance after it are permitted.
   * Only reachable when `speakAiMessage` reported that nothing was heard.
   */
  const handlePlayBlockedAudio = async () => {
    const message = blockedAudioMessage;
    if (!message) return;

    setRecordingError(null);
    const heard = await speakAiMessage(message);
    if (!isMountedRef.current) return;

    // Cleared either way. A second failure cannot be an activation problem —
    // the tap supplied it — so leaving the button up would loop the candidate
    // on a control that has already done all it can. `onPlaybackError` has put
    // the real reason in the inline slot.
    setBlockedAudioMessage(null);

    if (heard && !sessionCompleteRef.current) {
      await tryAutoStartRecording();
    }
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
      openingGeneratedRef.current ||
      openingAttempt > MAX_OPENING_ATTEMPTS
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

        // `readJson` surfaces the route's own message and survives a non-JSON
        // error body, where parsing directly threw a parse error that masked
        // the real status.
        const data = await readJson<ChatTurnResponse>(response);

        if (!isMountedRef.current) {
          return;
        }

        const openingMessage: DisplayMessage = {
          id: `msg-${Date.now()}-opening`,
          role: "ai",
          content: data.aiMessage,
          timestamp: formatMessageTime(),
        };

        setMessages([openingMessage]);

        const heard = await speakAiMessage(data.aiMessage);

        if (!isMountedRef.current || sessionCompleteRef.current) return;

        /**
         * Do not open the microphone on a question nobody heard.
         *
         * This used to run unconditionally, so a candidate whose browser
         * blocked the greeting was recorded answering a question that had only
         * ever appeared as text — and the silence watch would then auto-submit
         * whatever it caught. Offering the tap is both the fix and the thing
         * that unblocks audio for the rest of the session.
         */
        if (!heard) {
          setBlockedAudioMessage(data.aiMessage);
          return;
        }

        await tryAutoStartRecording();
      } catch (err) {
        console.warn("Error generating opening greeting:", err);
        if (!isMountedRef.current) return;

        /**
         * Release the latch so the interview is recoverable.
         *
         * The latch is set *before* the request — correctly, since it is what
         * stops a second effect run firing a second greeting — but nothing
         * cleared it on failure and nothing retried. One transient error left
         * an empty transcript, an idle microphone and no error on screen: the
         * session was over before it began, and the only way out was a reload.
         */
        openingGeneratedRef.current = false;
        setError(
          err instanceof Error
            ? err.message
            : "Could not start the interview. Retrying…",
        );
        setOpeningAttempt((attempt) => attempt + 1);
      }
    };

    void generateOpening();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isLoading,
    setupError,
    activePersonaConfig,
    activeScenarioValue,
    openingAttempt,
  ]);

  /**
   * Switch this turn between speaking and typing code.
   *
   * Turning the editor on has to close the microphone *without* submitting —
   * `speech.stop()` stops and completes, which is the wrong half here — and
   * discard whatever was captured, because the candidate has decided that
   * partial spoken answer is not the one they are giving. `speech.discard()`
   * is exactly that half, and takes the silence watch and the response
   * deadline with it: typing is silent, so leaving the watch armed would
   * auto-submit an empty transcript partway through writing a function.
   */
  const setWritingCode = async (next: boolean) => {
    if (next === isWritingCodeRef.current) return;

    // Set the ref before awaiting, so `tryAutoStartRecording` — which the TTS
    // completion handler can fire during that await — already sees it.
    isWritingCodeRef.current = next;
    setIsWritingCode(next);

    if (!next) return;

    await speech.discard();
  };

  const handleSendCode = async (answer: string) => {
    // Back to speaking for the next question, so the round does not silently
    // become a typing round after one coding answer.
    setIsWritingCode(false);
    isWritingCodeRef.current = false;
    await handleSend(answer);
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
          timestamp: formatMessageTime(),
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
          timestamp: formatMessageTime(),
        },
      ]);

      const speechService = speechServiceRef.current;
      const ttsEnabled = Boolean(voiceConfigRef.current?.ttsEnabled);
      const prosody = {
        ratePercent: paceToRatePercent(activePersonaConfig.pace),
      };
      let ttsBuffer = "";
      // Everything the stream has produced this turn. `ttsBuffer` is only the
      // tail not yet handed to the synthesizer, so the difference between them
      // is exactly what has already been voiced — which the recovery path below
      // needs in order not to say it twice.
      let streamedText = "";
      let startedSpeaking = false;

      const enqueueSentences = (flush: boolean) => {
        if (!ttsEnabled) return;
        const { sentences, rest } = extractSpeakableSentences(ttsBuffer, {
          flush,
          /**
           * Nothing is held back before the first word is out.
           *
           * The 48-character floor merges a short sentence into the one after
           * it, so playback does not stutter through "Right." "Got it." mid
           * reply. Applied to the *opening* sentence it does something else
           * entirely: a reply beginning "Thanks for that." is 16 characters, so
           * the interviewer stayed completely silent until a second full
           * sentence had streamed in — often a second or more after the text
           * was already on screen.
           *
           * Latency matters more than smoothness for the first utterance and
           * smoothness matters more afterwards, so the floor starts at zero and
           * comes back once audio is playing.
           */
          minChars: startedSpeaking ? 48 : 0,
        });
        ttsBuffer = rest;
        for (const sentence of sentences) {
          if (!startedSpeaking) {
            startedSpeaking = true;
            setIsSpeakingTts(true);
          }
          /**
           * `void` attached no handler, so a synthesis failure or the 30s
           * backstop became a bare unhandled rejection in the browser — and
           * `reportPlaybackFailure` is not called on that path, so nothing
           * reached the UI either. A mid-reply Azure error left the candidate
           * with silence and no explanation.
           */
          speechService
            .speakQueued(
              sentence,
              voiceConfigRef.current?.selectedVoiceUri,
              prosody,
            )
            .catch((speakError: unknown) => {
              console.warn("TTS synthesis failed:", speakError);
              if (isMountedRef.current) {
                setRecordingError(
                  "The interviewer's voice cut out. The transcript is still on screen.",
                );
              }
            });
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

      let result: ChatTurnResponse;
      try {
        result = await consumeChatStream<ChatTurnResponse>(
          chatResponse,
          (chunk) => {
            streamedText += chunk;
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
        // Streaming failed mid-flight. The route persists the turn before it
        // emits `done`, so this may already have succeeded server-side —
        // re-posting would duplicate the turn and pay for it twice. Ask the
        // server what it stored before deciding.
        const recovered = bootstrap.sessionId
          ? await recoverPersistedTurn(bootstrap.sessionId, userMessage)
          : null;

        if (recovered) {
          result = recovered;
        } else {
          const fallback = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: bootstrap.sessionId,
              userMessage,
              streamResponse: false,
            }),
          });
          result = await readJson<ChatTurnResponse>(fallback);
        }

        /**
         * Queue only what was never spoken.
         *
         * This used to be `ttsBuffer = result.aiMessage` — the whole reply —
         * so the flush below re-read it from the top over audio that was
         * already playing. The candidate heard the opening sentences twice,
         * overlapping.
         *
         * `recoverPersistedTurn` returns the same turn the stream was midway
         * through, so its text shares a prefix with what has already been
         * voiced and only the remainder is new. The re-POST fallback generates
         * a *different* reply, and the prefix check fails — there, anything
         * already spoken belongs to an abandoned answer, so it is silenced and
         * the new reply is spoken whole.
         */
        const voiced = streamedText.slice(
          0,
          streamedText.length - ttsBuffer.length,
        );

        if (voiced && result.aiMessage.startsWith(voiced)) {
          ttsBuffer = result.aiMessage.slice(voiced.length);
        } else {
          if (voiced) {
            await speechService.stopSpeaking();
            startedSpeaking = false;
          }
          ttsBuffer = result.aiMessage;
        }
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

      // Clear the speaking indicator once all queued audio has finished playing,
      // then start the response timer / microphone automatically.
      if (startedSpeaking) {
        void speechService.waitForQueuedPlayback().finally(async () => {
          if (!isMountedRef.current) return;
          setIsSpeakingTts(false);
          if (!sessionCompleteRef.current) {
            await tryAutoStartRecording();
          }
        });
      } else if (!sessionCompleteRef.current) {
        void tryAutoStartRecording();
      }

      if (!isMountedRef.current) {
        return;
      }

      // Trivial answers come back with analysis null — skip scored bookkeeping.
      if (!result.analysis || !result.strategy) {
        return;
      }

      // The hint arrives with the reply, derived from the same analysis that
      // produced the score. Voice used to discard it.
      if (result.microFeedback) {
        const micro = result.microFeedback;
        setMessages((current) =>
          current.map((item) =>
            item.id === userMessageId
              ? {
                  ...item,
                  feedbackHint: micro.hint,
                  feedbackTone: micro.tone,
                }
              : item,
          ),
        );
      }

      const applied = turn.applyTurn(result);
      if (!applied) return;

      if (applied.isComplete) {
        sessionCompleteRef.current = true;
        // No `endSession()` here. `applyTurn` has already persisted the
        // completion including this turn; calling it again from a callback
        // closed over pre-turn state overwrote that with the mean over one
        // fewer analysis. The manual End-session button still calls it.
        setTimeout(() => {
          if (isMountedRef.current) {
            router.push(
              bootstrap.sessionId
                ? `/simulate/report/${bootstrap.sessionId}`
                : "/dashboard",
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
        setIsSpeakingTts(false);

        // Reopen the microphone. This branch skips the auto-start above, so a
        // single failed request used to end the interview in practice: the
        // error was shown, the mic stayed shut, and the only way forward was a
        // button the candidate had no reason to think was needed.
        if (!sessionCompleteRef.current) {
          void tryAutoStartRecording();
        }
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
      <div className="flex h-screen items-center justify-center bg-slate-50 px-6">
        <Card className="max-w-md border-destructive-border bg-destructive-subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive-emphasis">
              <AlertCircle className="h-5 w-5" />
              Could not open session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-destructive-emphasis">
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
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Card className="w-96 border-destructive-border bg-destructive-subtle">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive-emphasis">
              <AlertCircle className="h-5 w-5" />
              Setup error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-destructive-emphasis">
              {setupError}
            </p>
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
      if (speech.isBusy()) {
        void speechService.stopListening();
      }
    } catch {
      // ignore
    }
    setIsSpeakingTts(false);
  };

  const handleEndSession = async () => {
    // Refuse while a turn is in flight: `endSession` PATCHes from pre-turn
    // state and the running `handleSend` will PATCH again through `applyTurn`,
    // giving two undefined-order writers to `averageScore`.
    if (isEnding || isSending) return;
    setIsEnding(true);
    const sessionId = bootstrap.sessionId;
    await turn.endSession();
    router.push(sessionId ? `/simulate/report/${sessionId}` : "/dashboard");
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <div className="h-16 bg-white border-b border-slate-200/80 flex items-center px-6 gap-4 shadow-soft">
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="hover:bg-slate-100 transition-colors duration-150"
        >
          <Link
            href="/dashboard"
            onClick={handleNavigateAway}
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold">Voice practice</h1>
          <p className="text-sm text-slate-500 truncate">
            {activeScenario.title} • {activePersonaConfig.name} •{" "}
            {voiceConfig.ttsEnabled ? "TTS on" : "TTS off"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <JobDescriptionChip
            title={bootstrap.jobDescriptionTitle}
            missing={bootstrap.jobDescriptionMissing}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="shadow-soft">
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
            // Held shut while a turn is streaming; see `handleEndSession`.
            disabled={isSending || isEnding}
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

      <div className="flex flex-1 overflow-hidden bg-linear-to-br from-slate-50 via-white to-primary-subtle/60">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="border-b border-slate-200/70 bg-linear-to-r from-white via-slate-50 to-primary-subtle/50 px-6 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                  Voice interview
                </div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Adaptive session in progress
                </h2>
              </div>
              {/* The group is right-anchored by the parent's `justify-between`,
                  so these transient badges grow the group leftwards and the
                  two stable badges below keep their position. All they need is
                  to arrive rather than appear — a fade and a slight scale,
                  with no directional slide, since which way they enter from
                  depends on how much is already in the row. */}
              <div className="flex items-center gap-2">
                {isSpeakingTts && (
                  <>
                    <Badge
                      variant="secondary"
                      className="h-8 gap-1.5 px-3 text-primary-emphasis bg-primary-muted animate-in fade-in-0 zoom-in-95 duration-200 ease-soft"
                    >
                      <span className="h-2 w-2 animate-breathe rounded-full bg-primary" />
                      Interviewer speaking
                    </Badge>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 animate-in fade-in-0 zoom-in-95 duration-200 ease-soft"
                      onClick={() => void stopTts()}
                    >
                      Stop voice
                    </Button>
                  </>
                )}
                {speech.isRecording && (
                  <Badge
                    variant="destructive"
                    className="h-8 gap-1.5 px-3 animate-in fade-in-0 zoom-in-95 duration-200 ease-soft"
                  >
                    <span className="relative flex h-2 w-2 items-center justify-center">
                      {/* The ping is decoration on top of a red badge that
                          already says "Recording", so losing it under reduced
                          motion costs no information. */}
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                    </span>
                    Recording
                  </Badge>
                )}
                <Badge variant="outline" className="h-8 px-3 tabular-nums">
                  Question {Math.min(turn.scoredTurns + 1, turn.targetTurns)} of
                  ~{turn.targetTurns}
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
                  deliveryNote={msg.delivery}
                  feedbackHint={msg.feedbackHint}
                  feedbackTone={msg.feedbackTone}
                />
              ))}

              {error && (
                <Card className="border-warning-border bg-warning-subtle/80">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-warning-emphasis">
                      Coaching note
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-warning-emphasis">{error}</p>
                  </CardContent>
                </Card>
              )}

              {blockedAudioMessage && (
                <Card className="border-primary-border bg-primary-subtle/80">
                  <CardContent className="flex flex-wrap items-center gap-3 py-4">
                    <Volume2
                      className="size-5 shrink-0 text-primary-emphasis"
                      aria-hidden
                    />
                    <p className="min-w-48 flex-1 text-sm text-primary-emphasis">
                      Your browser blocked the interviewer&rsquo;s audio until
                      you interact with the page.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => void handlePlayBlockedAudio()}
                      disabled={isSpeakingTts}
                    >
                      Tap to hear the interviewer
                    </Button>
                  </CardContent>
                </Card>
              )}

              {isSending && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span className="h-2 w-2 animate-breathe rounded-full bg-primary" />
                  Generating interviewer response...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="border-t border-slate-200/70 bg-white/80 p-4 backdrop-blur">
            {/* Only where the round type has an editor at all — `technical_swe`
                today. A behavioural round in voice mode shows the microphone
                and nothing else, exactly as before. */}
            {supportsCodeEditor(activeRound?.type) && (
              <div className="mb-3 flex items-center gap-2">
                <ChoiceChip
                  selected={!isWritingCode}
                  onClick={() => void setWritingCode(false)}
                  icon={<Mic className="h-3.5 w-3.5 shrink-0" />}
                >
                  Speak
                </ChoiceChip>
                <ChoiceChip
                  selected={isWritingCode}
                  onClick={() => void setWritingCode(true)}
                  icon={<Code2 className="h-3.5 w-3.5 shrink-0" />}
                >
                  Write code
                </ChoiceChip>
              </div>
            )}

            {isWritingCode ? (
              <CodeInput
                key={`code-${messages.length}`}
                language={codeLanguage}
                onLanguageChange={setCodeLanguage}
                onSend={(answer) => void handleSendCode(answer)}
                disabled={isSending || turn.stage === "report"}
                timeLimitSeconds={RESPONSE_TIME_LIMIT_SECONDS}
                timeoutFallbackMessage={NO_RESPONSE_MESSAGE}
              />
            ) : (
              <VoiceInput
                isRecording={speech.isRecording}
                isProcessing={isSending}
                isSpeakingTts={isSpeakingTts}
                interimTranscript={speech.interimTranscript}
                finalTranscript={speech.finalTranscript}
                recordingError={speech.recordingError}
                timeLimitSeconds={RESPONSE_TIME_LIMIT_SECONDS}
                deadlineMs={speech.answerDeadlineMs}
                silenceStartedAtMs={speech.silenceStartedAtMs}
                autoStartRecording
                onStart={() => void startAnswering()}
                onStop={() => void speech.stop()}
                onStopTts={stopTts}
              />
            )}
          </div>
        </div>

        <CoachingRail
          open={showLiveCoaching}
          onOpenChange={setShowLiveCoaching}
          turn={turn}
        />
      </div>

      <Dialog open={isAdvancedStateOpen} onOpenChange={setIsAdvancedStateOpen}>
        <DialogContent className="max-w-3xl border-slate-200 bg-white/95 backdrop-blur">
          <DialogHeader className="text-left">
            <DialogTitle>Advanced system state</DialogTitle>
            <DialogDescription>
              Internal interview strategy and decision context for debugging and
              optimization.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <InterviewStatePanel
              state={turn.sessionState}
              stageLabel={stageLabel}
              stageGuidance={getStageGuidance(
                turn.stage,
                turn.metrics,
                turn.lastFollowupPrompt,
              )}
              lastStrategy={turn.lastStrategy}
              decisionReason={turn.lastDecisionReason}
              decisionConfidence={turn.lastConfidence}
              metrics={turn.metrics}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
