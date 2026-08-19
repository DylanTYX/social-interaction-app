"use client";

import { AlertCircle } from "lucide-react";

import { VoiceInput } from "@/components/chat/voice-input";
import {
  useSpeechAnswer,
  type SpeechAnswerCompletion,
} from "@/hooks/use-speech-answer";

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
 * The recording control is `VoiceInput`, unchanged, so the microphone looks and
 * behaves identically in a drill and in an interview.
 */
export function DrillSpeakInput({
  timeLimitSeconds,
  phraseList,
  disabled,
  onComplete,
}: {
  timeLimitSeconds: number;
  /** Recognition bias, usually the drill question itself. */
  phraseList?: string[];
  disabled?: boolean;
  onComplete: (completion: SpeechAnswerCompletion) => void;
}) {
  const speech = useSpeechAnswer({
    timeLimitSeconds,
    phraseList,
    onComplete,
  });

  if (speech.tokenError) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-destructive-border bg-destructive-subtle/70 p-4 text-sm text-destructive-emphasis">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          The microphone could not be set up: {speech.tokenError} You can still
          type or paste your answer.
        </p>
      </div>
    );
  }

  return (
    <VoiceInput
      isRecording={speech.isRecording}
      isProcessing={Boolean(disabled)}
      // A drill has no interviewer, so nothing is ever speaking back and the
      // "Stop interviewer voice" control has nothing to stop. Omitting
      // `onStopTts` is what keeps it off screen.
      isSpeakingTts={false}
      interimTranscript={speech.interimTranscript}
      finalTranscript={speech.finalTranscript}
      recordingError={speech.recordingError}
      timeLimitSeconds={timeLimitSeconds}
      deadlineMs={speech.answerDeadlineMs}
      silenceStartedAtMs={speech.silenceStartedAtMs}
      // Reserved up front and sized to be read, not glanced at. In the
      // interview the transcript is a confirmation under a conversation; here
      // it is the answer taking shape, and it is the only thing on the card.
      keepTranscriptMounted
      transcriptClassName="min-h-32 max-h-48 text-sm"
      onStart={() => void speech.start()}
      onStop={() => void speech.stop()}
    />
  );
}
