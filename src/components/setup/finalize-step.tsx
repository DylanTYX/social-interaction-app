"use client";

import {
  CheckCircle2,
  FileText,
  Mic,
  MessageSquare,
  TrendingUp,
  Volume2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { getCurrentRound, ROUND_TYPE_LABELS } from "@/lib/interview-rounds";
import { getScenarioByValue } from "@/lib/scenarios";
import {
  describeRoundLength,
  targetTurnsForRound,
} from "@/lib/interview-progress";
import type { InterviewSetupState } from "@/lib/interview-setup";

/**
 * Final step of the setup wizard: review the session, check the microphone if
 * this is a voice interview, and launch.
 *
 * Extracted from `setup/page.tsx` alongside `PersonaStep`. It reads the whole
 * setup object and reports patches back, so the seam is the object itself
 * rather than a long prop list.
 *
 * The job-description and resume pickers used to live here and now sit on the
 * first step, where they belong — they are context, not final tuning, and
 * collecting them last meant the round builder's "Suggest from job
 * description" button could never fire on a first pass.
 */

export function FinalizeStep({
  setup,
  onUpdate,
  onMicCheck,
  microphoneStatus,
  microphoneMessage,
}: {
  setup: InterviewSetupState;
  onUpdate: (partial: Partial<InterviewSetupState>) => void;
  onMicCheck: () => void;
  microphoneStatus: "idle" | "checking" | "ready" | "failed";
  microphoneMessage: string | null;
}) {
  const activeScenario = getScenarioByValue(
    setup.scenarioValue,
    setup.customScenarioBrief,
  );
  const activeRound = getCurrentRound(setup.interviewLoop);

  // What you are about to sit through, counted rather than described. Both
  // numbers come from the same helper the live session uses to decide when a
  // round is over, so the estimate cannot drift from the real thing.
  const rounds = setup.interviewLoop.enabled
    ? setup.interviewLoop.rounds
    : [activeRound];
  const totalQuestions = rounds.reduce(
    (sum, round) => sum + targetTurnsForRound(round),
    0,
  );
  const totalMinutes = rounds.reduce(
    (sum, round) => sum + round.durationMinutes,
    0,
  );

  return (
    <div className="space-y-6">
      <Card className="border border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Your session</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <SummaryRow
            label="Mode"
            value={
              setup.practiceMode === "voice"
                ? "Voice interview"
                : "Text interview"
            }
          />
          <SummaryRow label="Brief" value={activeScenario.title} />
          <SummaryRow
            label={setup.interviewLoop.enabled ? "Rounds" : "Session"}
            value={
              setup.interviewLoop.enabled
                ? `${setup.interviewLoop.rounds.length} rounds · starting with ${ROUND_TYPE_LABELS[activeRound.type]}`
                : `${ROUND_TYPE_LABELS[activeRound.type]} · ${describeRoundLength(activeRound.durationMinutes)}`
            }
          />
          <SummaryRow label="Interviewer" value={setup.personaConfig.name} />
          <SummaryRow
            label="Style"
            value={`${setup.personaConfig.communicationStyle} • Strict ${setup.personaConfig.strictness} • Pace ${setup.personaConfig.pace ?? 5} • Pushback ${setup.personaConfig.pushback ?? 5}`}
          />
          <SummaryRow
            label="Job description"
            // Names the document or says there isn't one. It used to branch on
            // `mode`, which meant clicking "From library" without picking
            // anything reported "Selected" — a review step asserting a choice
            // that had not been made.
            value={
              setup.jobDescription.enabled
                ? (setup.jobDescription.savedTitle ?? "None chosen")
                : "Not used"
            }
          />
          <SummaryRow
            label="Resume"
            // Same rule as the row above, and it had the same defect: this
            // branched on `mode` and reported "Selected" for a library tab
            // nothing had been picked from, or "Pasted text (n chars)" for a
            // paste that no longer becomes anything — the picker saves to the
            // library now, so a resume in play always has a title.
            value={
              setup.resume.enabled
                ? (setup.resume.savedTitle ?? "None chosen")
                : "Not used"
            }
          />
        </CardContent>
      </Card>

      {/* The adaptive loop is what this project actually does differently, and
          until now nothing in the flow said so — you pressed Start and found
          out. Static copy would have been marketing; every line here is
          derived from the config you just built. */}
      <Card className="border border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">What happens next</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <NextStep
            icon={MessageSquare}
            title={`~${totalQuestions} questions over about ${totalMinutes} minutes`}
            detail={
              setup.practiceMode === "voice"
                ? "You speak your answers; the interviewer replies out loud."
                : "You type your answers; the interviewer replies in the chat."
            }
          />
          <NextStep
            icon={TrendingUp}
            title="Each answer is scored, then the next question adapts"
            detail="Strong answers earn harder follow-ups. Vague ones get pushed on for a specific example or number."
          />
          <NextStep
            icon={CheckCircle2}
            title={
              setup.interviewLoop.enabled
                ? `${rounds.length} rounds run back to back, with a short break between each`
                : "One round, run start to finish"
            }
            detail={rounds
              .map((round) => ROUND_TYPE_LABELS[round.type])
              .join(" → ")}
          />
          <NextStep
            icon={FileText}
            title="A full report at the end"
            detail="Transcript, per-answer scores, strengths and gaps, and a suggested answer for any question you want to compare against."
          />
        </CardContent>
      </Card>

      {/* Two identical single-toggle panels became one card. The dashboard's
          settings page groups its switches the same way. */}
      <Card className="border border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">During the interview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white p-3">
            {/* `space-y-1`: these two were previously wrapped in a bare
                `<div>` with no spacing class of any kind, so the gap was the
                browser's default `<p>` margin — the only unmanaged spacing in
                the wizard. `text-sm font-medium` on the Label is also already
                the `Label` default. */}
            <div className="space-y-1">
              <Label htmlFor="stream-responses">Live response streaming</Label>
              <p className="text-xs leading-5 text-muted-foreground">
                Stream the interviewer&apos;s reply token-by-token as it&apos;s
                generated.
              </p>
            </div>
            <Switch
              id="stream-responses"
              checked={setup.streamResponses}
              onCheckedChange={(checked) =>
                onUpdate({ streamResponses: checked })
              }
            />
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white p-3">
            {/* `space-y-1`: these two were previously wrapped in a bare
                `<div>` with no spacing class of any kind, so the gap was the
                browser's default `<p>` margin — the only unmanaged spacing in
                the wizard. `text-sm font-medium` on the Label is also already
                the `Label` default. */}
            <div className="space-y-1">
              <Label htmlFor="live-coaching">Live coaching tips</Label>
              <p className="text-xs leading-5 text-muted-foreground">
                Show short notes after each answer, including what you did well.
              </p>
            </div>
            <Switch
              id="live-coaching"
              checked={setup.liveCoachingEnabled}
              onCheckedChange={(checked) =>
                onUpdate({ liveCoachingEnabled: checked })
              }
            />
          </div>
        </CardContent>
      </Card>

      {setup.practiceMode === "voice" && (
        <Card className="border border-border shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic className="h-4 w-4 text-primary" />
              Voice readiness
            </CardTitle>
            <CardDescription>
              Confirm the interviewer can talk to you and you can talk back.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-white p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Volume2 className="h-4 w-4 text-primary" />
                  Text-to-speech
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Hear interviewer prompts aloud.
                  </p>
                  <Switch
                    checked={setup.voiceConfig.ttsEnabled}
                    onCheckedChange={(checked) =>
                      onUpdate({
                        voiceConfig: {
                          ...setup.voiceConfig,
                          ttsEnabled: checked,
                        },
                      })
                    }
                  />
                </div>
              </div>
            </div>

            {/*
              This was a six-voice dropdown. It is gone because a session-level
              voice silently flattened every interviewer in a multi-round loop
              to the same one — you could line up a recruiter, an engineer and a
              hiring manager and hear a single voice read all three. The accent
              now comes from each interviewer's own nationality, so the only
              session-level control left is whether accents apply at all.
            */}
            <div className="rounded-xl border border-border bg-white p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Volume2 className="h-4 w-4 text-primary" />
                Interviewer accents
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  Each interviewer speaks English with the accent their
                  nationality suggests. Turn off for neutral English throughout.
                </p>
                <Switch
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
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
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
              </p>
            </div>

            <div className="rounded-xl border border-dashed border-primary-border bg-primary-subtle/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2
                    className={`h-4 w-4 ${
                      microphoneStatus === "ready"
                        ? "text-success"
                        : "text-muted-foreground"
                    }`}
                  />
                  {microphoneStatus === "ready"
                    ? "Microphone access verified"
                    : setup.voiceConfig.microphoneChecked
                      ? "Microphone was checked previously"
                      : "Microphone has not been checked yet"}
                </div>
                <Button
                  variant="outline"
                  onClick={onMicCheck}
                  disabled={microphoneStatus === "checking"}
                >
                  {microphoneStatus === "checking"
                    ? "Checking..."
                    : "Check mic"}
                </Button>
              </div>
              {microphoneMessage && (
                <p
                  className={`mt-2 text-xs ${
                    microphoneStatus === "failed"
                      ? "text-destructive"
                      : "text-success-emphasis"
                  }`}
                >
                  {microphoneMessage}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function NextStep({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof MessageSquare;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium leading-5 text-foreground">{title}</p>
        <p className="text-xs leading-5 text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
