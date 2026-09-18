"use client";

import { Loader2, Mic, Square, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AnswerCountdown } from "@/components/chat/answer-countdown";
import { SilenceIndicator } from "@/components/chat/silence-indicator";
import { PANEL_LABEL } from "@/components/dashboard/page-header";
import { SILENCE_SUBMIT_MS } from "@/lib/silence-detection";
import { describeSpeechError } from "@/lib/speech-errors";
import { countWords } from "@/lib/speech-metrics";
import { cn } from "@/lib/utils";

interface VoiceInputProps {
  isRecording: boolean;
  isProcessing: boolean;
  isSpeakingTts: boolean;
  interimTranscript: string;
  finalTranscript: string;
  recordingError: string | null;
  timeLimitSeconds: number;
  /**
   * The deadline the page's timeout will actually fire on. Passing it is what
   * makes the digits and the cutoff the same clock; without it the countdown
   * stamps its own on mount and the two only agree by luck.
   */
  deadlineMs?: number | null;
  /** When the current pause began, or null while the candidate is speaking. */
  silenceDeadline?: {
    atMs: number;
    pending: "submit" | "prompt";
  } | null;
  /** When true, recording is started by the page after the interviewer speaks. */
  autoStartRecording?: boolean;
  onStart: () => void;
  onStop: () => void;
  onStopTts?: () => void;
}

type VoiceState = "idle" | "recording" | "speaking" | "processing";

/**
 * The spoken answer surface for an interview.
 *
 * The same recorder a drill uses, for the reason it was built there: one row
 * holding the button, what is happening now and what ends the answer, and the
 * clock — then the transcript at reading size under it.
 *
 * What it replaces was a stack: a timer line, a thin grey box reading
 * "Listening for your answer…", a centred button, a caption under it and a
 * reserved line under that. Five rows down the middle of a wide strip, with
 * the one thing you need mid-answer — how long is left — set in body text at
 * the top, and nothing anywhere saying that a pause sends the answer.
 *
 * The interview's own states stay: the interviewer speaking, with the way to
 * cut in; the page's sending state; and a clock that runs on the page's
 * deadline rather than one of its own.
 */
export function VoiceInput({
  isRecording,
  isProcessing,
  isSpeakingTts,
  interimTranscript,
  finalTranscript,
  recordingError,
  timeLimitSeconds,
  deadlineMs,
  silenceDeadline = null,
  autoStartRecording = false,
  onStart,
  onStop,
  onStopTts,
}: VoiceInputProps) {
  /**
   * Ordered by what the candidate most needs to know.
   *
   * Speaking outranks processing, which is the reverse of the obvious reading
   * — but `isProcessing` is the page's `isSending`, and that stays true for the
   * *whole* streamed reply, while audio starts partway through it. Checking it
   * first meant the control showed "Processing your answer" with a spinner
   * while the interviewer was audibly talking, and the speaking state was only
   * ever reachable in the gap after the request settled.
   */
  const state: VoiceState = isRecording
    ? "recording"
    : isSpeakingTts
      ? "speaking"
      : isProcessing
        ? "processing"
        : "idle";

  const settled = finalTranscript.trim();
  const pending = interimTranscript.trim();
  const hearing = Boolean(settled || pending);
  const words = hearing ? countWords(`${settled} ${pending}`) : 0;
  const silenceSeconds = Math.round(SILENCE_SUBMIT_MS / 1000);
  const errorMessage = describeSpeechError(recordingError);

  const copy: Record<VoiceState, { title: string; hint: string }> = {
    idle: {
      title: autoStartRecording ? "Your turn next" : "Tap to answer out loud",
      hint: autoStartRecording
        ? "Your microphone opens when the interviewer finishes."
        : `Pause for ${silenceSeconds} seconds when you're done and your answer is sent.`,
    },
    recording: {
      title: "Listening",
      hint: `Pause for ${silenceSeconds} seconds when you're done, or tap to finish now.`,
    },
    speaking: {
      title: "Interviewer speaking",
      hint: "Tap the microphone to cut in and answer now.",
    },
    processing: {
      title: "Sending your answer…",
      hint: "The interviewer replies in a moment.",
    },
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-white transition-[border-color,box-shadow] duration-150",
        // The open microphone is marked the way a focused field is.
        state === "recording"
          ? "border-primary ring-[3px] ring-primary-muted"
          : "border-slate-200",
      )}
    >
      <div className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
        <Button
          size="icon"
          onClick={state === "recording" ? onStop : onStart}
          disabled={state === "processing"}
          aria-label={
            state === "recording"
              ? "Submit answer now"
              : state === "speaking"
                ? "Interrupt and answer now"
                : "Start answering"
          }
          // Blue in every state. Recording used to turn the button red, but red
          // means an error here, and recording is the thing going right.
          className="size-12 shrink-0 rounded-full"
        >
          {state === "processing" ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : state === "recording" ? (
            <Square className="size-4 fill-current" aria-hidden />
          ) : (
            <Mic className="size-5" aria-hidden />
          )}
        </Button>

        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="font-medium text-slate-900">{copy[state].title}</p>
          <p className="mt-0.5 text-sm text-slate-500">{copy[state].hint}</p>
        </div>

        {/* One slot on the right: while the interviewer talks, the way to stop
            them; otherwise the clock, which is idle until you are speaking. */}
        {state === "speaking" && onStopTts ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onStopTts}
            className="shrink-0"
          >
            <VolumeX />
            Stop voice
          </Button>
        ) : (
          <div className="hidden shrink-0 text-right sm:block">
            <AnswerCountdown
              // Remounted on the recording flag so stopping resets to the full
              // limit rather than holding at wherever the clock stopped.
              key={isRecording ? "recording" : "idle"}
              deadlineMs={deadlineMs ?? undefined}
              timeLimitSeconds={timeLimitSeconds}
              paused={!isRecording}
              label={null}
              className="font-display text-xl leading-none font-semibold tabular-nums"
            />
            <p className="mt-1 text-xs text-slate-500">
              {isRecording ? "left" : "per answer"}
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5">
        <div className="flex h-5 items-center justify-between gap-3">
          <p className={PANEL_LABEL}>
            {isRecording || hearing ? "Hearing" : "Transcript"}
          </p>
          <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums">
            <SilenceIndicator deadline={silenceDeadline} />
            {/* The clock, for screens too narrow to hold it in the row above. */}
            {isRecording && (
              <AnswerCountdown
                key="narrow"
                deadlineMs={deadlineMs ?? undefined}
                timeLimitSeconds={timeLimitSeconds}
                label={null}
                className="sm:hidden"
              />
            )}
            {words > 0 && (
              <span>
                {words} word{words === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>

        <div
          // Polite: a live transcript announced assertively would talk over
          // everything else a screen-reader user is doing.
          aria-live="polite"
          className="mt-2 max-h-32 min-h-12 overflow-y-auto text-[15px] leading-relaxed"
        >
          {errorMessage ? (
            <p
              role="alert"
              className="rounded-lg border border-warning-border bg-warning-subtle px-3 py-2 text-sm text-warning-emphasis"
            >
              {errorMessage}
            </p>
          ) : hearing ? (
            <p>
              <span className="text-slate-800">{settled}</span>
              {settled && pending ? " " : null}
              <span className="text-slate-400">{pending}</span>
            </p>
          ) : isRecording ? (
            <p className="text-slate-400">Start whenever you&apos;re ready.</p>
          ) : (
            <p className="text-slate-400">
              Your words appear here as you speak.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
