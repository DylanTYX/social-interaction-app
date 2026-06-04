"use client";

import { useEffect, useState } from "react";
import { Mic, MicOff, Square, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";

interface VoiceInputProps {
  isRecording: boolean;
  isProcessing: boolean;
  isSpeakingTts: boolean;
  interimTranscript: string;
  finalTranscript: string;
  recordingError: string | null;
  timeLimitSeconds: number;
  /** When true, recording is started by the page after the interviewer speaks. */
  autoStartRecording?: boolean;
  onStart: () => void;
  onStop: () => void;
  onStopTts?: () => void;
}

function formatRemainingTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${minutes.toString().padStart(2, "0")}:${remainder
    .toString()
    .padStart(2, "0")}`;
}

/**
 * Bottom-of-page recording control for the voice interview. It mirrors
 * `ChatInput`'s structure (timer line + primary action bar) so the text and
 * voice pages feel like siblings.
 *
 * Timer implementation: rather than calling `Date.now()` during render (which
 * is impure) or assigning state synchronously inside an effect, we drive
 * `elapsedSeconds` from a setInterval callback. The first sample is scheduled
 * on a microtask so the effect body itself stays free of synchronous setState
 * calls.
 */
export function VoiceInput({
  isRecording,
  isProcessing,
  isSpeakingTts,
  interimTranscript,
  finalTranscript,
  recordingError,
  timeLimitSeconds,
  autoStartRecording = false,
  onStart,
  onStop,
  onStopTts,
}: VoiceInputProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!isRecording) {
      return;
    }

    const startTime = Date.now();
    const update = () => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    };

    queueMicrotask(update);
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [isRecording]);

  const remainingSeconds = isRecording
    ? Math.max(0, timeLimitSeconds - elapsedSeconds)
    : timeLimitSeconds;
  const timerWarning =
    isRecording && remainingSeconds <= Math.min(60, timeLimitSeconds * 0.15);
  const livePreview = [finalTranscript, interimTranscript]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div
          className={`text-xs font-medium ${
            timerWarning ? "text-red-600" : "text-slate-500"
          }`}
        >
          {isRecording ? (
            <>Response timer: {formatRemainingTime(remainingSeconds)}</>
          ) : autoStartRecording && !isProcessing && !isSpeakingTts ? (
            <>
              Response timer: {formatRemainingTime(timeLimitSeconds)} · starts
              when the interviewer finishes
            </>
          ) : (
            <>Response timer: {formatRemainingTime(remainingSeconds)}</>
          )}
        </div>
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

      {(livePreview || recordingError) && (
        <div
          className={`rounded-xl border px-3 py-2 text-xs leading-relaxed ${
            recordingError
              ? "border-red-200 bg-red-50/70 text-red-800"
              : "border-slate-200 bg-slate-50/70 text-slate-600"
          }`}
        >
          {recordingError ? (
            recordingError
          ) : (
            <>
              <span className="mr-1 font-semibold text-slate-500">
                Hearing
              </span>
              <span className="text-slate-700">{livePreview}</span>
            </>
          )}
        </div>
      )}

      <div className="flex items-end gap-3">
        {!isRecording ? (
          <Button
            onClick={onStart}
            disabled={isProcessing}
            size="lg"
            className="h-[60px] flex-1 gap-2 shadow-soft-md hover:shadow-soft-lg transition-all duration-200"
          >
            <Mic className="h-5 w-5" />
            {isProcessing
              ? "Processing your last answer..."
              : autoStartRecording
                ? "Start recording early"
                : "Start recording"}
          </Button>
        ) : (
          <Button
            onClick={onStop}
            variant="destructive"
            size="lg"
            className="h-[60px] flex-1 gap-2 shadow-soft-md hover:shadow-soft-lg transition-all duration-200"
          >
            <span className="relative flex h-3 w-3 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            <Square className="h-4 w-4" />
            Stop recording
          </Button>
        )}

        {!isRecording && (
          <div
            className="hidden h-[60px] w-[60px] shrink-0 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white/60 text-slate-400 sm:flex"
            aria-hidden="true"
          >
            <MicOff className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}
