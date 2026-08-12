"use client";

import { Loader2, Mic, Square, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AnswerCountdown } from "@/components/chat/answer-countdown";
import { SilenceIndicator } from "@/components/chat/silence-indicator";
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
  silenceStartedAtMs?: number | null;
  /** When true, recording is started by the page after the interviewer speaks. */
  autoStartRecording?: boolean;
  onStart: () => void;
  onStop: () => void;
  onStopTts?: () => void;
}

/**
 * Bottom-of-page recording control for the voice interview.
 *
 * Rebuilt around a single circular control. It used to be a full-width 60px bar
 * plus a decorative 60×60 tile whose only job was to width-match `ChatInput`'s
 * send button — and because the tile was hidden while recording, the primary
 * button jumped 72px wider on that transition, mid-answer. State now reads from
 * colour and a ring rather than from the button's size, and the whole block is
 * a fixed height, so nothing moves between states.
 *
 * There is also now a real *speaking* state. Previously, while the interviewer
 * was talking, the button still read "Start recording early" — the only hint
 * that it was the interviewer's turn lived elsewhere on the page.
 *
 * Timer implementation: the countdown is `<AnswerCountdown>`, the same leaf the
 * text and code inputs use. Keeping the tick out here stops the live transcript
 * preview, which already re-renders on every partial recognition result, from
 * being re-rendered four more times a second on top of that.
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
  silenceStartedAtMs = null,
  autoStartRecording = false,
  onStart,
  onStop,
  onStopTts,
}: VoiceInputProps) {
  const livePreview = [finalTranscript, interimTranscript]
    .filter(Boolean)
    .join(" ")
    .trim();

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
  const state = isRecording
    ? "recording"
    : isSpeakingTts
      ? "speaking"
      : isProcessing
        ? "processing"
        : "idle";

  const caption = {
    processing: "Processing your answer",
    recording: "Listening — pause when you're done",
    speaking: "Interviewer speaking",
    idle: autoStartRecording
      ? "Your mic opens when the interviewer finishes"
      : "Tap to answer",
  }[state];

  // The transcript slot stays mounted for the whole answer so the composer does
  // not grow under the candidate the moment they start talking.
  const showTranscriptSlot =
    isRecording || Boolean(livePreview) || Boolean(recordingError);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <AnswerCountdown
          // Remounted on the recording flag so stopping resets to the full
          // limit rather than holding at wherever the clock stopped.
          key={isRecording ? "recording" : "idle"}
          deadlineMs={deadlineMs ?? undefined}
          timeLimitSeconds={timeLimitSeconds}
          paused={!isRecording}
          suffix={
            state === "idle" && autoStartRecording ? (
              <> · starts when the interviewer finishes</>
            ) : undefined
          }
        />
        {isSpeakingTts && onStopTts && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onStopTts}
            className="h-7 gap-1.5 text-xs text-slate-600 hover:text-slate-900"
          >
            <VolumeX className="h-3.5 w-3.5" />
            Stop interviewer voice
          </Button>
        )}
      </div>

      {showTranscriptSlot && (
        <div
          // Polite: a live transcript announced assertively would talk over
          // everything else a screen-reader user is doing.
          aria-live="polite"
          className={cn(
            "max-h-24 overflow-y-auto rounded-xl border px-3 py-2 text-xs leading-relaxed",
            recordingError
              ? "border-red-200 bg-red-50/70 text-red-800"
              : "border-slate-200 bg-slate-50/70 text-slate-600",
          )}
        >
          {recordingError ? (
            recordingError
          ) : livePreview ? (
            <>
              <span className="mr-1 font-semibold text-slate-500">Hearing</span>
              <span className="text-slate-700">{livePreview}</span>
            </>
          ) : (
            <span className="text-slate-400">Listening for your answer…</span>
          )}
        </div>
      )}

      {/* Fixed height: the control changes appearance between states, never size. */}
      <div className="flex h-21 flex-col items-center justify-center gap-1.5">
        <div className="relative">
          {state === "recording" && (
            <span
              className="pointer-events-none absolute -inset-1 animate-breathe rounded-full ring-4 ring-red-400/40"
              aria-hidden="true"
            />
          )}
          <Button
            onClick={state === "recording" ? onStop : onStart}
            disabled={state === "processing"}
            variant={state === "recording" ? "destructive" : "default"}
            size="icon"
            aria-label={
              state === "recording"
                ? "Submit answer now"
                : state === "speaking"
                  ? "Interrupt and answer now"
                  : "Start answering"
            }
            className="relative size-14 rounded-full shadow-soft-md transition-all duration-200 hover:shadow-soft-lg"
          >
            {state === "processing" ? (
              <Loader2 className="size-6 animate-spin" />
            ) : state === "recording" ? (
              <Square className="size-5 fill-current" />
            ) : (
              <Mic className="size-6" />
            )}
          </Button>
        </div>

        <p className="text-xs font-medium text-slate-500">{caption}</p>

        {/* Sits under the caption so the countdown appears without moving it. */}
        <SilenceIndicator silenceStartedAtMs={silenceStartedAtMs} />
      </div>
    </div>
  );
}
