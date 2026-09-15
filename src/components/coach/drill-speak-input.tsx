"use client";

import { AlertCircle, Loader2, Mic, Square } from "lucide-react";

import { AnswerCountdown } from "@/components/chat/answer-countdown";
import { SilenceIndicator } from "@/components/chat/silence-indicator";
import { PANEL_LABEL } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import {
  useSpeechAnswer,
  type SpeechAnswerCompletion,
} from "@/hooks/use-speech-answer";
import { SILENCE_SUBMIT_MS } from "@/lib/silence-detection";
import { cn } from "@/lib/utils";

function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

type RecorderState = "connecting" | "idle" | "recording" | "processing";

/**
 * The spoken answer surface for a drill.
 *
 * A component rather than a call to `useSpeechAnswer` inside the drills page,
 * for one hard reason: `speech-service.ts` imports the Azure Speech SDK at
 * module scope, and the SDK resolves a Node-only certificate path when it is
 * evaluated on the server. `simulate/voice/page.tsx` already handles that by
 * loading its screen through `next/dynamic` with `ssr: false`, and the drills
 * page — an ordinary client component that Next still renders on the server —
 * needs the same wall. Keeping the hook behind this file is what gives the
 * drills page something to `dynamic()` on.
 *
 * It used to render `VoiceInput`, the interview's composer: a timer line, a
 * grey box and a small centred button with a caption. Under a conversation
 * that control is rightly secondary. On a drill the microphone is the whole
 * task, and the composer made it look like an afterthought. So this is a
 * recorder built for the job:
 *
 *   - One row: the button, what is happening now and what ends the answer, and
 *     the clock. The rules come from the constants that enforce them.
 *   - Below it, the transcript at reading size. Recognised words are dark,
 *     words still being recognised are light, and once the answer is sent it
 *     stays on screen, because the hook clears its own transcript on stop.
 *
 * Behaviour is the interview's: the same hook, the same button shape and
 * labels, the same countdown and silence leaves.
 */
export function DrillSpeakInput({
  timeLimitSeconds,
  phraseList,
  disabled,
  lastAnswer,
  onComplete,
}: {
  timeLimitSeconds: number;
  /** Recognition bias, usually the drill question itself. */
  phraseList?: string[];
  /** True while the coach is reading the answer. */
  disabled?: boolean;
  /** The answer most recently sent, shown until the next recording starts. */
  lastAnswer?: string;
  onComplete: (completion: SpeechAnswerCompletion) => void;
}) {
  const speech = useSpeechAnswer({
    timeLimitSeconds,
    phraseList,
    onComplete,
  });

  if (speech.tokenError) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-destructive-border bg-destructive-subtle px-4 py-3 text-sm text-destructive-emphasis"
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p>
          The microphone could not be set up: {speech.tokenError} You can still
          type your answer.
        </p>
      </div>
    );
  }

  const state: RecorderState = speech.isRecording
    ? "recording"
    : disabled
      ? "processing"
      : speech.tokenStatus === "ready"
        ? "idle"
        : // Tapping before the first token lands reported "Your microphone
          // session expired", which is untrue on a page that just opened.
          "connecting";

  const silenceSeconds = Math.round(SILENCE_SUBMIT_MS / 1000);
  const minutes = Math.round(timeLimitSeconds / 60);

  const copy: Record<RecorderState, { title: string; hint: string }> = {
    connecting: {
      title: "Connecting to your microphone…",
      hint: "This takes a moment.",
    },
    idle: {
      title: "Tap to answer out loud",
      hint: `Up to ${minutes} minutes. Stop talking for ${silenceSeconds} seconds and your answer is sent.`,
    },
    recording: {
      title: "Listening",
      hint: `Pause for ${silenceSeconds} seconds when you're done, or tap to finish now.`,
    },
    processing: {
      title: "Coaching your answer…",
      hint: "Your feedback appears below.",
    },
  };

  const settled = speech.finalTranscript.trim();
  const pending = speech.interimTranscript.trim();
  const hearing = Boolean(settled || pending);
  const showLast =
    !speech.isRecording && !hearing && Boolean(lastAnswer?.trim());
  const words = hearing
    ? countWords(`${settled} ${pending}`)
    : showLast
      ? countWords(lastAnswer ?? "")
      : 0;

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
      <div className="flex items-center gap-4 px-4 py-4 sm:px-5">
        <Button
          size="icon"
          onClick={
            state === "recording"
              ? () => void speech.stop()
              : () => void speech.start()
          }
          disabled={state === "processing" || state === "connecting"}
          aria-label={
            state === "recording" ? "Submit answer now" : "Start answering"
          }
          className="size-14 shrink-0 rounded-full"
        >
          {state === "processing" || state === "connecting" ? (
            <Loader2 className="size-6 animate-spin" aria-hidden />
          ) : state === "recording" ? (
            <Square className="size-5 fill-current" aria-hidden />
          ) : (
            <Mic className="size-6" aria-hidden />
          )}
        </Button>

        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="font-medium text-slate-900">{copy[state].title}</p>
          <p className="mt-0.5 text-sm text-slate-500">{copy[state].hint}</p>
        </div>

        <div className="hidden shrink-0 text-right sm:block">
          <AnswerCountdown
            // Remounted on the recording flag so stopping resets to the full
            // limit rather than holding at wherever the clock stopped.
            key={speech.isRecording ? "recording" : "idle"}
            deadlineMs={speech.answerDeadlineMs ?? undefined}
            timeLimitSeconds={timeLimitSeconds}
            paused={!speech.isRecording}
            label={null}
            className="font-display text-xl leading-none font-semibold tabular-nums"
          />
          <p className="mt-1 text-xs text-slate-500">
            {speech.isRecording ? "left" : "time limit"}
          </p>
        </div>
      </div>

      <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:px-5">
        <div className="flex h-5 items-center justify-between gap-3">
          <p className={PANEL_LABEL}>
            {speech.isRecording || hearing
              ? "Hearing"
              : showLast
                ? "Your answer"
                : "Transcript"}
          </p>
          <div className="flex items-center gap-3 text-xs text-slate-500 tabular-nums">
            <SilenceIndicator silenceStartedAtMs={speech.silenceStartedAtMs} />
            {/* The clock, for screens too narrow to hold it in the row above. */}
            {speech.isRecording && (
              <AnswerCountdown
                key="narrow"
                deadlineMs={speech.answerDeadlineMs ?? undefined}
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
          className="mt-2 max-h-72 min-h-20 overflow-y-auto text-[15px] leading-relaxed"
        >
          {speech.recordingError ? (
            <p
              role="alert"
              className="rounded-lg border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-emphasis"
            >
              {speech.recordingError}
            </p>
          ) : hearing ? (
            <p>
              <span className="text-slate-800">{settled}</span>
              {settled && pending ? " " : null}
              <span className="text-slate-400">{pending}</span>
            </p>
          ) : speech.isRecording ? (
            <p className="text-slate-400">Start whenever you&apos;re ready.</p>
          ) : showLast ? (
            <p className="whitespace-pre-line text-slate-700">{lastAnswer}</p>
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
