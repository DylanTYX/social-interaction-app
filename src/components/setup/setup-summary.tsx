"use client";

import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Mic,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { PANEL_LABEL } from "@/components/dashboard/page-header";
import { describeDifficulty } from "@/lib/interview-difficulty";
import { targetTurnsForRound } from "@/lib/interview-progress";
import { getCurrentRound } from "@/lib/interview-rounds";
import type { InterviewSetupState } from "@/lib/interview-setup";
import { roundTypeSpec } from "@/lib/round-types";
import { briefTitle } from "@/lib/scenarios";
import { TILE_COLORS } from "@/lib/tile-colors";
import { cn } from "@/lib/utils";

export type MicrophoneStatus = "idle" | "checking" | "ready" | "failed";

/**
 * The interview you are building, beside every step, with the step buttons.
 *
 * The wizard used to describe your choices only on its last step, as a grid
 * of labels, so three steps were filled in blind and the review repeated what
 * you had just done. This panel says it all the way through and updates as
 * you go: the mode and how long it runs, the brief, the rounds as their tags,
 * the interviewer and how demanding they are, the documents, and for a voice
 * interview the microphone, which Start interview checks before it launches.
 *
 * Every number comes from the helpers the live session uses, so the estimate
 * cannot drift from the interview you get.
 */
export function SetupSummary({
  setup,
  microphoneStatus,
  stepLabel,
  isFirstStep,
  isLastStep,
  blockedReason,
  isLaunching,
  onBack,
  onNext,
}: {
  /** The setup as launch will record it, documents resolved to library rows. */
  setup: InterviewSetupState;
  microphoneStatus: MicrophoneStatus;
  stepLabel: string;
  isFirstStep: boolean;
  isLastStep: boolean;
  /** Null when the step is complete; an empty string when there is nothing to say. */
  blockedReason: string | null;
  isLaunching: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const voice = setup.practiceMode === "voice";
  const ModeIcon = voice ? Mic : MessageSquare;
  const loop = setup.interviewLoop;
  const rounds = loop.enabled ? loop.rounds : [getCurrentRound(loop)];
  const questions = rounds.reduce(
    (sum, round) => sum + targetTurnsForRound(round),
    0,
  );
  const minutes = rounds.reduce((sum, round) => sum + round.durationMinutes, 0);
  const brief = setup.customScenarioBrief?.trim() ?? "";
  const difficulty = describeDifficulty(
    setup.personaConfig.strictness,
    setup.personaConfig.warmth,
  );
  const micChecking = microphoneStatus === "checking";
  const micFailed = microphoneStatus === "failed";
  const canProceed = blockedReason === null;

  return (
    <Card className="gap-0 py-0" aria-label="Your interview">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className={PANEL_LABEL}>Your interview</p>
        <p className="mt-2 flex items-center gap-2 font-display text-lg font-semibold tracking-tight text-slate-900">
          <ModeIcon className="h-4 w-4 text-primary" aria-hidden />
          {voice ? "Voice interview" : "Text interview"}
        </p>
        <p className="mt-0.5 text-sm text-slate-500 tabular-nums">
          {questions} questions · about {minutes} min
        </p>
      </div>

      <dl className="divide-y divide-slate-100 px-5">
        <Row label="Brief">
          {brief ? (
            <span className="text-slate-900">{briefTitle(brief)}</span>
          ) : (
            <span className="text-slate-400">Not written yet</span>
          )}
        </Row>

        <Row label={rounds.length > 1 ? `${rounds.length} rounds` : "Round"}>
          <span className="flex flex-wrap items-center gap-1">
            {rounds.map((round, index) => {
              const spec = roundTypeSpec(round.type);
              return (
                <span key={round.id} className="flex items-center gap-1">
                  {index > 0 && (
                    <ChevronRight
                      className="h-3 w-3 text-slate-400"
                      aria-hidden
                    />
                  )}
                  <span
                    className={cn(
                      "inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs font-semibold",
                      TILE_COLORS[spec.accent],
                    )}
                  >
                    {spec.label}
                    <span className="font-medium opacity-70 tabular-nums">
                      {round.durationMinutes}m
                    </span>
                  </span>
                </span>
              );
            })}
          </span>
          {rounds.length > 1 && (
            <span className="mt-1.5 block text-xs text-slate-500 tabular-nums">
              {loop.breakMinutes} min break between rounds
            </span>
          )}
        </Row>

        <Row label="Interviewer">
          <span className="flex items-center gap-2.5">
            <InitialsAvatar name={setup.personaConfig.name} size="sm" />
            <span className="min-w-0">
              <span className="block truncate font-medium text-slate-900">
                {setup.personaConfig.name}
              </span>
              <span className="block truncate text-xs text-slate-500">
                {difficulty.label}
              </span>
            </span>
          </span>
        </Row>

        <Row label="Job description">
          <DocumentValue
            enabled={setup.jobDescription.enabled}
            title={setup.jobDescription.savedTitle}
          />
        </Row>

        <Row label="Resume">
          <DocumentValue
            enabled={setup.resume.enabled}
            title={setup.resume.savedTitle}
          />
        </Row>

        {voice && (
          <Row label="Microphone">
            <span className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn(
                  "h-2 w-2 shrink-0 rounded-[2px]",
                  microphoneStatus === "ready"
                    ? "bg-success"
                    : micFailed
                      ? "bg-warning"
                      : "bg-slate-300",
                )}
              />
              <span
                className={cn(
                  microphoneStatus === "ready"
                    ? "text-slate-900"
                    : micFailed
                      ? "text-warning-emphasis"
                      : "text-slate-500",
                )}
              >
                {microphoneStatus === "ready"
                  ? "Working"
                  : micFailed
                    ? "Not working yet"
                    : micChecking
                      ? "Checking…"
                      : "Checked when you start"}
              </span>
            </span>
          </Row>
        )}
      </dl>

      <div className="space-y-2 border-t border-slate-100 px-5 py-4">
        {/* What to expect, read at the moment of starting. The two facts a new
            user cannot see anywhere else on this page. */}
        {isLastStep && (
          <p className="text-xs leading-5 text-slate-600">
            Each answer is scored and shapes the next question. You get a full
            report at the end.
          </p>
        )}
        {!canProceed && blockedReason && (
          <p className="text-xs leading-5 text-warning-emphasis" role="status">
            {blockedReason}
          </p>
        )}
        {isLastStep && voice && micFailed && (
          <p className="text-xs leading-5 text-warning-emphasis" role="status">
            Your microphone isn&apos;t working. Fix it and press Start interview
            again, or switch to a text interview.
          </p>
        )}
        {/* Present in the card from `lg`; below that the same two buttons
            live in a bar pinned to the bottom of the screen, because here the
            card sits under the whole form and the primary action was at the
            end of a long scroll. */}
        <div className="hidden space-y-2 lg:block">
          <SetupActions
            voice={voice}
            isFirstStep={isFirstStep}
            isLastStep={isLastStep}
            canProceed={canProceed}
            micChecking={micChecking}
            isLaunching={isLaunching}
            onBack={onBack}
            onNext={onNext}
            layout="stack"
          />
        </div>
        <p className="sr-only" aria-live="polite">
          Step: {stepLabel}
        </p>
      </div>
    </Card>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-3">
      <dt className={PANEL_LABEL}>{label}</dt>
      <dd className="mt-1.5 text-sm">{children}</dd>
    </div>
  );
}

function DocumentValue({
  enabled,
  title,
}: {
  enabled: boolean;
  title: string | null;
}) {
  if (!enabled) return <span className="text-slate-400">Not used</span>;
  if (!title) return <span className="text-warning-emphasis">None chosen</span>;
  return <span className="block truncate text-slate-900">{title}</span>;
}

/**
 * Continue and Back, in the two shapes the wizard needs: stacked inside the
 * summary card on wide screens, side by side in a sticky bar on phones. One
 * component so the gating — blocked, launching, microphone still checking —
 * cannot differ between the two.
 */
export function SetupActions({
  voice,
  isFirstStep,
  isLastStep,
  canProceed,
  micChecking,
  isLaunching,
  onBack,
  onNext,
  layout,
}: {
  voice: boolean;
  isFirstStep: boolean;
  isLastStep: boolean;
  canProceed: boolean;
  micChecking: boolean;
  isLaunching: boolean;
  onBack: () => void;
  onNext: () => void;
  layout: "stack" | "bar";
}) {
  const next = (
    <Button
      className={layout === "stack" ? "w-full" : "min-w-0 flex-1"}
      onClick={onNext}
      disabled={!canProceed || isLaunching || micChecking}
    >
      {isLastStep ? (
        <>
          {voice && <Mic />}
          {micChecking
            ? "Checking microphone…"
            : isLaunching
              ? "Starting…"
              : "Start interview"}
        </>
      ) : (
        <>
          Continue
          <ArrowRight />
        </>
      )}
    </Button>
  );
  const back = (
    <Button
      variant="ghost"
      className={layout === "stack" ? "w-full text-slate-600" : "shrink-0 text-slate-600"}
      onClick={onBack}
    >
      <ChevronLeft />
      {isFirstStep ? "Cancel" : "Back"}
    </Button>
  );

  return layout === "stack" ? (
    <>
      {next}
      {back}
    </>
  ) : (
    <div className="flex items-center gap-2">
      {back}
      {next}
    </div>
  );
}
