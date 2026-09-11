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
  /**
   * Render the transcript slot even before there is anything to put in it.
   *
   * The interview leaves this off: its composer sits under a scrolling message
   * list, and an empty box there is dead weight. A drill is the opposite — the
   * answer surface is the whole card, so reserving the space stops the card
   * growing under the candidate the instant they press record.
   */
  keepTranscriptMounted?: boolean;
  /**
   * Sizing for the transcript slot. The default is a chat composer's: small,
   * capped, secondary to the conversation above it. A surface where speaking is
   * the only thing happening wants it bigger and readable.
   */
  transcriptClassName?: string;
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
  keepTranscriptMounted = false,
  transcriptClassName,
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

  /**
   * The transcript slot stays mounted for the whole answer so the composer does
   * not shrink under the candidate mid-sentence.
   *
   * That was only ever half of it: the slot still *appeared* when recording
   * began, so pressing record grew the surface by the height of the box. On a
   * chat composer under a scrolling list that is barely visible; on a drill,
   * where this is the entire card, it is a jump at the exact moment attention
   * moves to the microphone. `keepTranscriptMounted` reserves the space up
   * front instead.
   */
  const showTranscriptSlot =
    keepTranscriptMounted ||
    isRecording ||
    Boolean(livePreview) ||
    Boolean(recordingError);

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
              ? "border-destructive-border bg-destructive-subtle/70 text-destructive-emphasis"
              : "border-slate-200 bg-slate-50/70 text-slate-600",
            transcriptClassName,
          )}
        >
          {recordingError ? (
            recordingError
          ) : livePreview ? (
            <>
              <span className="mr-1 font-semibold text-slate-500">Hearing</span>
              <span className="text-slate-700">{livePreview}</span>
            </>
          ) : isRecording ? (
            <span className="text-slate-400">Listening for your answer…</span>
          ) : (
            // Reserved but idle. Says what the box is for rather than claiming
            // to be listening when the microphone is closed.
            <span className="text-slate-400">
              Your words will appear here as you speak.
            </span>
          )}
        </div>
      )}

      {/*
        Stable size without a fixed height. This was `h-21 justify-center` —
        84px for a 56px button, a caption and the silence countdown, which
        need more than that. Centred content that overflows spills both ways,
        so the button and the recording ring rose into the transcript box
        above. Every slot now has its own reserved height instead: padding
        that contains the ring, a one-line caption, and a line held open for
        the countdown so it can appear without moving anything.
      */}
      <div className="flex flex-col items-center gap-2 pt-1">
        <div className="relative p-2">
          {state === "recording" && (
            <span
              className="pointer-events-none absolute inset-1 animate-breathe rounded-full ring-4 ring-destructive/40"
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

        <p className="h-4 text-center text-xs leading-4 font-medium text-slate-500">
          {caption}
        </p>

        {/* A reserved line, so the countdown appears without moving the caption. */}
        <div className="flex h-4 items-center">
          <SilenceIndicator
            silenceStartedAtMs={silenceStartedAtMs}
            className="leading-4"
          />
        </div>
      </div>
    </div>
  );
}
