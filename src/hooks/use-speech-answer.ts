"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  appendUniqueTranscript,
  fetchSpeechToken,
  getSpeechService,
  type TranscriptResult,
} from "@/lib/speech-service";
import { decideSilence } from "@/lib/silence-detection";
import {
  analyzeDelivery,
  describeDelivery,
  type DeliveryMetrics,
  type PhraseTiming,
} from "@/lib/speech-metrics";

/**
 * Capture one spoken answer: token, microphone, transcript, delivery.
 *
 * Extracted from `simulate/voice/voice-session.tsx`, where it was ~200 lines
 * threaded through eight refs and a `handleStopRecordingRef` dance. The reason
 * to lift it rather than copy it into the drills page is the lesson already
 * written into `speech-service.ts`: that file carries a long comment about the
 * opening greeting being silent for months because `speak()` and
 * `speakQueued()` were two implementations of one job and only one of them
 * ever got fixed. A second copy of the recognition flow would have gone the
 * same way — the bugs solved here are not the kind anyone re-derives.
 *
 * Deliberately *only* recognition. TTS, turn-taking, and what to do with a
 * finished answer stay with the caller; the interview speaks and takes turns,
 * a drill does neither, and the microphone half is all they share.
 */

export type SpeechAnswerStopReason = "manual" | "silence" | "timeout";

export interface SpeechAnswerCompletion {
  /** Final + trailing interim, deduped. Empty when nothing was said. */
  transcript: string;
  /** Null when there was no speech to measure. */
  delivery: DeliveryMetrics | null;
  /** `describeDelivery(delivery)`, or null. */
  deliveryNote: string | null;
  reason: SpeechAnswerStopReason;
}

export type SpeechTokenStatus = "idle" | "fetching" | "ready" | "error";

export interface UseSpeechAnswerOptions {
  /**
   * Gate on the caller being ready. A token lasts minutes and costs a request,
   * so minting one before the page can use it wastes both.
   */
  enabled?: boolean;
  timeLimitSeconds: number;
  /** Recognition bias terms. Read through a ref, so it may change per turn. */
  phraseList?: string[];
  /**
   * Whether a long pause ends the answer by itself.
   *
   * On for a conversation, where waiting for a click after every reply is the
   * thing that stops it feeling like one. The caller can turn it off for a
   * surface where the candidate is expected to think mid-answer.
   */
  autoSubmitOnSilence?: boolean;
  /**
   * Called exactly once per recording, including a silent one — an empty
   * transcript is a result, not an error, and the caller decides whether it
   * means "say something" or "score the silence".
   */
  onComplete: (completion: SpeechAnswerCompletion) => void | Promise<void>;
}

export interface UseSpeechAnswer {
  tokenStatus: SpeechTokenStatus;
  tokenError: string | null;
  isRecording: boolean;
  interimTranscript: string;
  finalTranscript: string;
  recordingError: string | null;
  setRecordingError: (message: string | null) => void;
  /** When the current pause began, or null while the candidate is speaking. */
  silenceStartedAtMs: number | null;
  /** The instant the timeout will actually fire, so the digits cannot drift. */
  answerDeadlineMs: number | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  /** Close the microphone and throw the transcript away. No `onComplete`. */
  discard: () => Promise<void>;
  /** True while recording or mid-stop; the window in which `start` is a no-op. */
  isBusy: () => boolean;
  /**
   * True only while a stop is settling. Lets a caller tell "the microphone is
   * already open" (nothing to do) from "the last answer is still closing"
   * (worth waiting a moment), which `isBusy` folds together.
   */
  isStopping: () => boolean;
  isInitialized: () => boolean;
}

export function useSpeechAnswer({
  enabled = true,
  timeLimitSeconds,
  phraseList,
  autoSubmitOnSilence = true,
  onComplete,
}: UseSpeechAnswerOptions): UseSpeechAnswer {
  const speechServiceRef = useRef(getSpeechService());

  const [tokenStatus, setTokenStatus] = useState<SpeechTokenStatus>("idle");
  const [tokenError, setTokenError] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [silenceStartedAtMs, setSilenceStartedAtMs] = useState<number | null>(
    null,
  );
  const [answerDeadlineMs, setAnswerDeadlineMs] = useState<number | null>(null);

  const transcriptBufferRef = useRef("");
  /**
   * Mirrors `interimTranscript`, because the two paths that end a turn without
   * a click — the response timeout and the silence watch — run from closures
   * captured when recording *started*, where the state value is still "". The
   * trailing phrase is very often still interim at that moment, so reading the
   * state there silently dropped the end of the answer.
   */
  const interimTranscriptRef = useRef("");
  const phraseTimingsRef = useRef<PhraseTiming[]>([]);
  const isRecordingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const isMountedRef = useRef(true);
  const recordingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const silencePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Silence detection. `lastSpeechAtRef` is restamped on every recognition
  // event including interim ones, which is the high-frequency "still talking"
  // tick; `hasSpokenRef` gates the whole thing so an opening pause can never
  // submit an empty answer.
  const lastSpeechAtRef = useRef<number | null>(null);
  const hasSpokenRef = useRef(false);

  /**
   * Read through refs, refreshed every render.
   *
   * The timers below are armed once per answer and outlive the render that
   * armed them. Calling the captured `onComplete` meant calling a callback
   * chain frozen at that render — in the interview that silently discarded the
   * whole analysis history on every auto-submitted turn, because the handler it
   * reached built its next state from a stale array. The stop *button* was
   * always fine, since a click handler comes from the current render, which is
   * exactly why it survived manual testing.
   */
  const onCompleteRef = useRef(onComplete);
  const phraseListRef = useRef(phraseList);
  const timeLimitRef = useRef(timeLimitSeconds);
  const autoSubmitRef = useRef(autoSubmitOnSilence);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    phraseListRef.current = phraseList;
    timeLimitRef.current = timeLimitSeconds;
    autoSubmitRef.current = autoSubmitOnSilence;
  });

  /**
   * Mint a token, then schedule the next mint before this one expires.
   *
   * The token lasts nine minutes and this used to run exactly once, while the
   * default round is fifteen. At T+9:00 `isInitialized()` began returning false
   * and every caller of it failed silently. Renewing at 80% of the advertised
   * lifetime leaves headroom for a slow mint without letting the current token
   * lapse first, and a failed *renewal* surfaces exactly like a failed first
   * mint — the microphone is equally dead either way.
   */
  useEffect(() => {
    if (!enabled) return;

    const speechService = speechServiceRef.current;
    let cancelled = false;
    let renewalTimer: ReturnType<typeof setTimeout> | undefined;

    // Marks the start of an async side effect. There is no render-time value
    // to derive it from — the fetch has not happened yet.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTokenStatus("fetching");

    const mintToken = async () => {
      try {
        const tokenResponse = await fetchSpeechToken();
        if (cancelled) return;
        speechService.initialize({
          authorizationToken: tokenResponse.token,
          region: tokenResponse.region,
          expiresAt: Date.now() + tokenResponse.expiresInSeconds * 1000,
        });
        setTokenStatus("ready");
        setTokenError(null);

        renewalTimer = setTimeout(
          () => void mintToken(),
          Math.max(30_000, tokenResponse.expiresInSeconds * 1000 * 0.8),
        );
      } catch (error) {
        if (cancelled) return;
        setTokenError(
          error instanceof Error
            ? error.message
            : "Failed to initialize speech service.",
        );
        setTokenStatus("error");
      }
    };

    void mintToken();

    return () => {
      cancelled = true;
      if (renewalTimer) clearTimeout(renewalTimer);
    };
  }, [enabled]);

  const clearResponseTimeout = useCallback(() => {
    if (recordingTimeoutRef.current) {
      clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  }, []);

  const stopSilenceWatch = useCallback(() => {
    if (silencePollRef.current) {
      clearInterval(silencePollRef.current);
      silencePollRef.current = null;
    }
    setSilenceStartedAtMs(null);
  }, []);

  const clearTranscript = useCallback(() => {
    transcriptBufferRef.current = "";
    interimTranscriptRef.current = "";
    phraseTimingsRef.current = [];
    setFinalTranscript("");
    setInterimTranscript("");
  }, []);

  /**
   * The one path out of recording.
   *
   * `stop` and `discard` are this with and without a completion. Both are
   * re-entrant-safe through `isStoppingRef`, which matters because the timeout
   * and the silence watch can both fire at a click.
   */
  const finish = useCallback(
    async (reason: SpeechAnswerStopReason | "discard") => {
      if (isStoppingRef.current) return;
      isStoppingRef.current = true;

      try {
        await speechServiceRef.current.stopListening();

        if (!isMountedRef.current) return;

        isRecordingRef.current = false;
        setIsRecording(false);
        setAnswerDeadlineMs(null);
        stopSilenceWatch();
        clearResponseTimeout();

        const combined = appendUniqueTranscript(
          transcriptBufferRef.current,
          interimTranscriptRef.current,
        );
        const timings = phraseTimingsRef.current;
        clearTranscript();

        if (reason === "discard") {
          setRecordingError(null);
          return;
        }

        const delivery = combined ? analyzeDelivery(combined, timings) : null;

        /**
         * Cleared *before* awaiting the completion, not in the `finally`.
         *
         * Callers legitimately reopen the microphone from inside `onComplete`
         * — the interview does it as soon as the next question is read out —
         * and `start` bails on this flag. Leaving it set across the await made
         * every such reopen a silent no-op, which killed two recovery paths
         * outright. Re-entrancy is only a hazard for the `stopListening`
         * sequence above, and that has already run.
         */
        isStoppingRef.current = false;

        await onCompleteRef.current({
          transcript: combined,
          delivery,
          deliveryNote: delivery ? describeDelivery(delivery) : null,
          reason,
        });
      } catch (error) {
        if (isMountedRef.current) {
          setRecordingError(
            error instanceof Error
              ? error.message
              : "Failed to stop recording.",
          );
        }
      } finally {
        isStoppingRef.current = false;
      }
    },
    [clearResponseTimeout, clearTranscript, stopSilenceWatch],
  );

  /**
   * Watch for the candidate finishing, so they do not have to press a button.
   *
   * One interval for the whole answer. It writes state only when a pause starts
   * or ends — not on every tick — so a three-minute answer costs a couple of
   * renders rather than seven hundred; the visible countdown ticks inside
   * `SilenceIndicator`, which is a leaf for exactly that reason.
   */
  const startSilenceWatch = useCallback(() => {
    stopSilenceWatch();

    silencePollRef.current = setInterval(() => {
      if (!isRecordingRef.current || isStoppingRef.current) return;

      const decision = decideSilence({
        nowMs: Date.now(),
        lastSpeechAtMs: lastSpeechAtRef.current,
        hasSpoken: hasSpokenRef.current,
      });

      if (decision.kind === "submit" && autoSubmitRef.current) {
        stopSilenceWatch();
        void finish("silence");
        return;
      }

      const nextStart =
        decision.kind === "warning" || decision.kind === "submit"
          ? lastSpeechAtRef.current
          : null;
      setSilenceStartedAtMs((prev) => (prev === nextStart ? prev : nextStart));
    }, 250);
  }, [finish, stopSilenceWatch]);

  const start = useCallback(async () => {
    const speechService = speechServiceRef.current;

    if (isRecordingRef.current || isStoppingRef.current) return;

    if (!speechService.isInitialized()) {
      // A lapsed token. Returning quietly here left the page looking finished:
      // microphone never opening, nothing on screen to explain it or to click.
      setRecordingError(
        "Your microphone session expired. Tap the microphone to reconnect.",
      );
      return;
    }

    // Stop any TTS still playing so we do not record the speaker output.
    if (speechService.isSpeaking()) {
      await speechService.stopSpeaking();
    }

    try {
      setRecordingError(null);
      clearTranscript();
      isStoppingRef.current = false;
      lastSpeechAtRef.current = null;
      hasSpokenRef.current = false;
      setSilenceStartedAtMs(null);
      isRecordingRef.current = true;
      setIsRecording(true);
      clearResponseTimeout();

      await speechService.startListening(
        (result: TranscriptResult) => {
          if (!isMountedRef.current) return;

          // Any recognition event at all means the candidate is still going.
          // Interim results are the frequent ones and therefore the useful
          // ones; finals only arrive at phrase boundaries Azure chooses.
          if (result.final?.trim() || result.interim?.trim()) {
            lastSpeechAtRef.current = Date.now();
            hasSpokenRef.current = true;
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

            interimTranscriptRef.current = "";
            setInterimTranscript("");
          } else if (result.interim) {
            interimTranscriptRef.current = result.interim;
            setInterimTranscript(result.interim);
          }
        },
        (errorMsg: string) => {
          if (!isMountedRef.current) return;

          setRecordingError(errorMsg);
          isRecordingRef.current = false;
          setIsRecording(false);
          setAnswerDeadlineMs(null);
          stopSilenceWatch();
          clearResponseTimeout();
        },
        {
          phraseList: (phraseListRef.current ?? []).filter(
            (term): term is string => Boolean(term && term.trim()),
          ),
        },
      );

      // The recognizer reports failure through its onError callback and then
      // resolves normally, so reaching this line proves nothing by itself.
      // onError has already flipped `isRecordingRef` false — arming the
      // response deadline anyway meant a dead microphone still auto-submitted
      // "[No response...]" at the three-minute mark, over a question the
      // candidate had been unable to answer.
      if (!isRecordingRef.current) return;

      // Armed only once the recognizer is actually up. It used to be armed
      // before this await, so microphone permission and Azure's handshake were
      // charged against the candidate's answer time.
      const limitMs = timeLimitRef.current * 1000;
      setAnswerDeadlineMs(Date.now() + limitMs);
      recordingTimeoutRef.current = setTimeout(
        () => void finish("timeout"),
        limitMs,
      );

      startSilenceWatch();
    } catch (err) {
      if (!isMountedRef.current) return;
      setRecordingError(
        err instanceof Error ? err.message : "Recording failed.",
      );
      isRecordingRef.current = false;
      setIsRecording(false);
      setAnswerDeadlineMs(null);
      stopSilenceWatch();
      clearResponseTimeout();
    }
  }, [
    clearResponseTimeout,
    clearTranscript,
    finish,
    startSilenceWatch,
    stopSilenceWatch,
  ]);

  const stop = useCallback(() => finish("manual"), [finish]);

  const discard = useCallback(async () => {
    stopSilenceWatch();
    setAnswerDeadlineMs(null);
    clearResponseTimeout();

    if (isRecordingRef.current) {
      await finish("discard");
      return;
    }

    clearTranscript();
    setRecordingError(null);
  }, [clearResponseTimeout, clearTranscript, finish, stopSilenceWatch]);

  // Single unmount-only cleanup. Stops in-flight recognition and TTS so audio
  // does not bleed into other pages. The service instance is captured up-front
  // so the cleanup does not depend on the ref's value at unmount time.
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

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener("beforeunload", handleBeforeUnload);

      if (recordingTimeoutRef.current) {
        clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
      if (silencePollRef.current) {
        clearInterval(silencePollRef.current);
        silencePollRef.current = null;
      }

      try {
        speechService.cleanup();
      } catch (cleanupError) {
        console.warn("Speech service cleanup error:", cleanupError);
      }

      // Safety net for environments that fall back to browser-native speech.
      if (window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const isBusy = useCallback(
    () => isRecordingRef.current || isStoppingRef.current,
    [],
  );
  const isStopping = useCallback(() => isStoppingRef.current, []);
  const isInitialized = useCallback(
    () => speechServiceRef.current.isInitialized(),
    [],
  );

  return {
    tokenStatus,
    tokenError,
    isRecording,
    interimTranscript,
    finalTranscript,
    recordingError,
    setRecordingError,
    silenceStartedAtMs,
    answerDeadlineMs,
    start,
    stop,
    discard,
    isBusy,
    isStopping,
    isInitialized,
  };
}
