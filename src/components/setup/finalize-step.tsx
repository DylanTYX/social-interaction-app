"use client";

import { CheckCircle2, Mic, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getCurrentRound, ROUND_TYPE_LABELS } from "@/lib/interview-rounds";
import { getScenarioByValue } from "@/lib/scenarios";
import { describeRoundLength } from "@/lib/interview-progress";
import type { InterviewSetupState } from "@/lib/interview-setup";
import type { SpeechVoiceOption } from "@/lib/speech-voices";

/**
 * Final step of the setup wizard: review the session, check the microphone if
 * this is a voice interview, and launch.
 *
 * Extracted from `setup/page.tsx` alongside `PersonaStep`. It reads the whole
 * setup object and reports patches back, so the seam is the object itself
 * rather than a long prop list.
 *
 * The job-description and CV pickers used to live here and now sit on the
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
  voiceOptions,
}: {
  setup: InterviewSetupState;
  onUpdate: (partial: Partial<InterviewSetupState>) => void;
  onMicCheck: () => void;
  microphoneStatus: "idle" | "checking" | "ready" | "failed";
  microphoneMessage: string | null;
  // Read-only: the step only iterates and searches this catalogue.
  voiceOptions: readonly SpeechVoiceOption[];
}) {
  const activeScenario = getScenarioByValue(
    setup.scenarioValue,
    setup.customScenarioBrief,
  );
  const activeRound = getCurrentRound(setup.interviewLoop);

  return (
    <div className="space-y-6">
      <Card className="border border-border shadow-soft">
        <CardHeader className="pb-3">
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
            value={(() => {
              if (!setup.jobDescription.enabled) return "Not used";
              if (
                setup.jobDescription.mode === "saved" ||
                setup.jobDescription.mode === "upload"
              ) {
                return setup.jobDescription.savedTitle ?? "Selected";
              }
              const length = setup.jobDescription.rawText.trim().length;
              return length > 0
                ? `Pasted text (${length} chars)`
                : "Pending paste";
            })()}
          />
          <SummaryRow
            label="CV"
            value={(() => {
              if (!setup.resume.enabled) return "Not used";
              if (
                setup.resume.mode === "saved" ||
                setup.resume.mode === "upload"
              ) {
                return setup.resume.savedTitle ?? "Selected";
              }
              const length = setup.resume.rawText.trim().length;
              return length > 0
                ? `Pasted text (${length} chars)`
                : "Pending paste";
            })()}
          />
        </CardContent>
      </Card>

      {/* Two identical single-toggle panels became one card. The dashboard's
          settings page groups its switches the same way. */}
      <Card className="border border-border shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">During the interview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white p-3">
            <div>
              <Label htmlFor="stream-responses" className="text-sm font-medium">
                Live response streaming
              </Label>
              <p className="text-xs text-muted-foreground">
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
            <div>
              <Label htmlFor="live-coaching" className="text-sm font-medium">
                Live coaching tips
              </Label>
              <p className="text-xs text-muted-foreground">
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
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mic className="h-4 w-4 text-blue-600" />
              Voice readiness
            </CardTitle>
            <CardDescription>
              Confirm the interviewer can talk to you and you can talk back.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-white p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Volume2 className="h-4 w-4 text-blue-600" />
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

              <div className="rounded-xl border border-border bg-white p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Mic className="h-4 w-4 text-blue-600" />
                  Speech-to-text
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Convert your spoken answer to text.
                  </p>
                  <Switch
                    checked={setup.voiceConfig.sttEnabled}
                    onCheckedChange={(checked) =>
                      onUpdate({
                        voiceConfig: {
                          ...setup.voiceConfig,
                          sttEnabled: checked,
                        },
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Voice choice</Label>
              <Select
                value={setup.voiceConfig.selectedVoiceUri || "default"}
                onValueChange={(selectedValue) => {
                  const selectedVoice = voiceOptions.find(
                    (voice) => voice.uri === selectedValue,
                  );

                  onUpdate({
                    voiceConfig: {
                      ...setup.voiceConfig,
                      selectedVoiceName:
                        selectedVoice?.name ?? "Aria — US Female (warm)",
                      selectedVoiceUri:
                        selectedValue === "default" ? "" : selectedValue,
                    },
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a voice" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    Default (Aria — US Female)
                  </SelectItem>
                  {voiceOptions.map((voice) => (
                    <SelectItem key={voice.uri} value={voice.uri}>
                      {voice.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Selected:{" "}
                {setup.voiceConfig.selectedVoiceName ||
                  "Default (Aria — US Female)"}
              </p>
            </div>

            <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2
                    className={`h-4 w-4 ${
                      microphoneStatus === "ready"
                        ? "text-emerald-500"
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
                      ? "text-red-600"
                      : "text-emerald-700"
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
