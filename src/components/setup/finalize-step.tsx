"use client";

import { CheckCircle2, Loader2, MessageSquare, Mic } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  describeResolvedVoice,
  resolveVoiceForPersona,
} from "@/lib/persona-voice";
import type { InterviewSetupState, PracticeMode } from "@/lib/interview-setup";
import { cn } from "@/lib/utils";

/**
 * Final step of the setup wizard, "Ready": only what is left to act on before
 * you start. For a voice interview, the microphone status first; then the
 * in-interview settings.
 *
 * The microphone has no button of its own. Start interview checks it, so this
 * row only reports: what will happen, that it is checking, that it works, or
 * why it does not and what to do instead.
 *
 * A "What happens next" card used to sit here. Half of it repeated the summary
 * panel beside this step (questions, minutes, mode, rounds), and as a card of
 * reading material it competed with the controls you act on. Its two facts
 * worth keeping now sit in the panel, just above Start interview.
 *
 * Extracted from `setup/page.tsx` alongside `PersonaStep`. It reads the whole
 * setup object and reports patches back, so the seam is the object itself
 * rather than a long prop list.
 *
 * The job-description and resume pickers used to live here and now sit on the
 * first step, where they belong — they are context, not final tuning, and
 * collecting them last meant the round builder's "Suggest from job
 * description" button could never fire on a first pass.
 *
 * Every toggle and status here is a row in a hairline-divided list inside its
 * card. They used to be white boxes inside white cards, two borders saying one
 * thing, and the microphone status sat in a dashed blue panel that made a
 * status row look like an empty state.
 */

export function FinalizeStep({
  setup,
  onUpdate,
  onModeChange,
  microphoneStatus,
  microphoneMessage,
}: {
  setup: InterviewSetupState;
  onUpdate: (partial: Partial<InterviewSetupState>) => void;
  /**
   * Switching mode is one click from here: to voice from a text setup, and to
   * text when the microphone does not work.
   */
  onModeChange: (mode: PracticeMode) => void;
  microphoneStatus: "idle" | "checking" | "ready" | "failed";
  microphoneMessage: string | null;
}) {
  const voice = setup.practiceMode === "voice";
  const micReady = microphoneStatus === "ready";
  const micFailed = microphoneStatus === "failed";

  return (
    <div className="space-y-6">
      {/* The summary of what you built is the panel beside this step, which
          has been there all along; this step is only what is left to do
          before you start. For a voice interview that begins with the one
          thing that can stop it: the microphone. */}
      {voice ? (
        <Card className="gap-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Voice</CardTitle>
            <CardDescription>
              The interviewer speaks, and you answer out loud.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-slate-100">
            <div className="flex items-start gap-4 py-4">
              {/* A status icon at text size, not a tile: green once the
                  microphone works, amber while it does not. */}
              {micReady ? (
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-success"
                  aria-hidden
                />
              ) : microphoneStatus === "checking" ? (
                <Loader2
                  className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-primary"
                  aria-hidden
                />
              ) : (
                <Mic
                  className={cn(
                    "mt-0.5 h-5 w-5 shrink-0",
                    micFailed ? "text-warning-emphasis" : "text-slate-400",
                  )}
                  aria-hidden
                />
              )}
              <div className="min-w-0 flex-1" aria-live="polite">
                <p className="font-medium text-slate-900">
                  {micReady
                    ? "Microphone working"
                    : micFailed
                      ? "The microphone is not working yet"
                      : microphoneStatus === "checking"
                        ? "Checking your microphone…"
                        : "Microphone"}
                </p>
                <p
                  className={cn(
                    "mt-0.5 text-sm",
                    micFailed ? "text-warning-emphasis" : "text-slate-500",
                  )}
                  role={micFailed ? "alert" : undefined}
                >
                  {micFailed
                    ? (microphoneMessage ??
                      "Microphone access was denied or unavailable.")
                    : micReady
                      ? "You're ready to answer out loud."
                      : microphoneStatus === "checking"
                        ? "Allow access if your browser asks."
                        : "Checked when you press Start interview. Your browser asks for permission the first time, and nothing is recorded until the interview begins."}
                </p>
                {micFailed && (
                  <button
                    type="button"
                    onClick={() => onModeChange("text")}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-muted"
                  >
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                    Switch to a text interview
                  </button>
                )}
              </div>
            </div>

            <ToggleRow
              id="tts-enabled"
              label="Hear the interviewer"
              hint="The interviewer's questions are read aloud. Turn off to read them instead."
              checked={setup.voiceConfig.ttsEnabled}
              onCheckedChange={(checked) =>
                onUpdate({
                  voiceConfig: { ...setup.voiceConfig, ttsEnabled: checked },
                })
              }
            />

            {/*
              This was a six-voice dropdown. It is gone because a session-level
              voice silently flattened every interviewer in a multi-round loop
              to the same one — you could line up a recruiter, an engineer and a
              hiring manager and hear a single voice read all three. The accent
              now comes from each interviewer's own nationality, so the only
              session-level control left is whether accents apply at all.
            */}
            <ToggleRow
              id="accents-enabled"
              label="Interviewer accents"
              hint={
                <>
                  Each interviewer speaks English with the accent their
                  nationality suggests. Turn off for neutral English throughout.{" "}
                  {describeResolvedVoice(
                    resolveVoiceForPersona({
                      nationality: setup.personaConfig.nationality,
                      voiceGender: setup.personaConfig.voiceGender,
                      accentsEnabled: setup.voiceConfig.accentsEnabled,
                    }),
                    setup.personaConfig.name,
                    setup.personaConfig.nationality,
                  )}
                  {setup.interviewLoop.enabled &&
                    setup.interviewLoop.rounds.some(
                      (round) => round.personaLibraryId,
                    ) &&
                    " Rounds with their own interviewer use that interviewer's accent."}
                </>
              }
              checked={setup.voiceConfig.accentsEnabled}
              onCheckedChange={(checked) =>
                onUpdate({
                  voiceConfig: {
                    ...setup.voiceConfig,
                    accentsEnabled: checked,
                  },
                })
              }
            />
          </CardContent>
        </Card>
      ) : (
        // A text setup still offers the primary mode, in one line, the way
        // Quick drills offers speaking.
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-slate-500">
          <span>Interviews are spoken.</span>
          <button
            type="button"
            onClick={() => onModeChange("voice")}
            className="inline-flex items-center gap-1.5 rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-muted"
          >
            <Mic className="h-3.5 w-3.5" aria-hidden />
            Switch to a voice interview
          </button>
        </p>
      )}

      {/* Two identical single-toggle panels became one card. The dashboard's
          settings page groups its switches the same way. */}
      <Card className="gap-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">During the interview</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-slate-100">
          <ToggleRow
            id="stream-responses"
            label="Stream replies as they are written"
            hint={
              voice
                ? "The interviewer starts speaking before the whole reply is ready, which cuts the pause."
                : "Show the interviewer's reply as it is written rather than all at once."
            }
            checked={setup.streamResponses}
            onCheckedChange={(checked) =>
              onUpdate({ streamResponses: checked })
            }
          />
          <ToggleRow
            id="live-coaching"
            label="Live coaching tips"
            hint="Short notes after each answer, including what you did well."
            checked={setup.liveCoachingEnabled}
            onCheckedChange={(checked) =>
              onUpdate({ liveCoachingEnabled: checked })
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  id: string;
  label: string;
  hint: React.ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <p className="text-xs leading-5 text-slate-500">{hint}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="mt-0.5"
      />
    </div>
  );
}
