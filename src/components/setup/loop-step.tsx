"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, MoreHorizontal, Plus } from "lucide-react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import { PANEL_LABEL } from "@/components/dashboard/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { describeRoundLength } from "@/lib/interview-progress";
import {
  roundTypeSpec,
  rubricCriteria,
  supportsCodeEditor,
} from "@/lib/round-types";
import { exampleQuestionForRoundType } from "@/lib/question-bank";
import { selectRoundPlaybook } from "@/lib/interviewer-playbooks";
import { TILE_COLORS } from "@/lib/tile-colors";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  appendRoundToLoop,
  createLoopFromTemplate,
  removeRoundFromLoop,
  applyRoundType,
  SINGLE_ROUND,
  resolveAnswerFormat,
  ROUND_TYPE_LABELS,
  suggestLoopFromJobDescription,
  type InterviewLoopConfig,
  type InterviewRoundConfig,
  type InterviewRoundType,
} from "@/lib/interview-rounds";
import type { PracticeMode } from "@/lib/interview-setup";
import type { PersonaLibraryEntry } from "@/lib/persona-library";

/**
 * Build the interview: one round, or several.
 *
 * This used to open with a "Single round" vs "Custom loop" choice and then hide
 * the entire round editor behind the second option — asking "one round or
 * many?" before "what kind of interview?". Picking "single" therefore locked
 * you to a behavioural round with no way to say otherwise, which made a short
 * targeted session (just HR, just system design) unreachable.
 *
 * Round count is an outcome of what you're practising, not the opening
 * question. There is now always an editable round list; adding a second round
 * is what makes it a loop.
 */

interface Preset {
  id: string;
  label: string;
  build: (mode: PracticeMode) => InterviewLoopConfig;
}

const PRESETS: Preset[] = [
  {
    id: "single",
    label: "One round",
    build: (mode) => createLoopFromTemplate("single", mode),
  },
  {
    id: "custom",
    label: "Screen + behavioural",
    build: (mode) => createLoopFromTemplate("custom", mode),
  },
  {
    id: "swe",
    label: "Full SWE loop",
    // The JD suggester already knows this shape; feeding it a SWE phrase reuses
    // that logic rather than duplicating a round list here.
    build: (mode) => suggestLoopFromJobDescription("software engineer", mode),
  },
];

function isCustomised(value: InterviewLoopConfig): boolean {
  // Anything beyond a pristine single default round is worth not silently
  // discarding: presets replace the entire configuration.
  if (value.rounds.length > 1) return true;
  const [round] = value.rounds;
  return (
    round?.type !== SINGLE_ROUND.type ||
    round?.durationMinutes !== SINGLE_ROUND.durationMinutes ||
    round?.focus !== SINGLE_ROUND.focus ||
    Boolean(round?.answerFormat) ||
    Boolean(round?.personaLibraryId)
  );
}

export function LoopStep({
  value,
  practiceMode,
  jobDescriptionText,
  personaLibrary,
  onChange,
}: {
  value: InterviewLoopConfig;
  practiceMode: PracticeMode;
  jobDescriptionText: string;
  personaLibrary: PersonaLibraryEntry[];
  onChange: (value: InterviewLoopConfig) => void;
}) {
  const rounds = value.rounds;
  const isLoop = rounds.length > 1;
  const canSuggest = jobDescriptionText.trim().length >= 80;

  // A native `window.confirm` was the odd one out — every other destructive
  // action in the app goes through this dialog, and the browser prompt cannot
  // be styled, is announced differently, and is blocked outright in some
  // embedded contexts.
  const [pendingPreset, setPendingPreset] =
    useState<InterviewLoopConfig | null>(null);

  const applyPreset = (next: InterviewLoopConfig) => {
    if (isCustomised(value)) {
      setPendingPreset(next);
      return;
    }
    onChange(next);
  };

  const updateRound = (index: number, patch: Partial<InterviewRoundConfig>) => {
    onChange({
      ...value,
      rounds: rounds.map((round, i) =>
        i === index ? { ...round, ...patch } : round,
      ),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className={PANEL_LABEL}>Start from</span>
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPreset(preset.build(practiceMode))}
          >
            {preset.label}
          </Button>
        ))}
        {canSuggest && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              applyPreset(
                suggestLoopFromJobDescription(jobDescriptionText, practiceMode),
              )
            }
          >
            Suggest from job description
          </Button>
        )}
      </div>

      <ConfirmDeleteDialog
        open={pendingPreset !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPreset(null);
        }}
        title="Replace your rounds?"
        description="Starting from a preset discards the rounds you have set up, including any per-round interviewer and break settings."
        confirmLabel="Use preset"
        onConfirm={() => {
          if (pendingPreset) onChange(pendingPreset);
          setPendingPreset(null);
        }}
      />

      {/* The shape of the interview day, above the cards that configure it.
          A three-round loop was three stacked cards you had to scroll and read
          to see what you had built; this says it in one line. Each round is
          its tag, in its round colour, the same chain the landing page draws. */}
      {isLoop && (
        <div className="flex flex-wrap items-center gap-1.5 border-y border-slate-100 py-3">
          {rounds.map((round, index) => {
            const spec = roundTypeSpec(round.type);
            return (
              <div key={round.id} className="flex items-center gap-1.5">
                {index > 0 && (
                  <ChevronRight
                    className="h-3.5 w-3.5 text-slate-400"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-semibold",
                    TILE_COLORS[spec.accent],
                  )}
                >
                  {spec.label}
                  <span className="font-medium opacity-70 tabular-nums">
                    {round.durationMinutes}m
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="space-y-6">
        {rounds.map((round, index) => (
          <RoundCard
            key={round.id}
            round={round}
            index={index}
            total={rounds.length}
            personaLibrary={personaLibrary}
            onChange={(patch) => updateRound(index, patch)}
            onRemove={
              isLoop ? () => onChange(removeRoundFromLoop(value, index)) : null
            }
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange(appendRoundToLoop(value, practiceMode))}
        >
          <Plus />
          Add round
        </Button>
      </div>
    </div>
  );
}

function RoundCard({
  round,
  index,
  total,
  personaLibrary,
  onChange,
  onRemove,
}: {
  round: InterviewRoundConfig;
  index: number;
  total: number;
  personaLibrary: PersonaLibraryEntry[];
  onChange: (patch: Partial<InterviewRoundConfig>) => void;
  onRemove: (() => void) | null;
}) {
  const isLoop = total > 1;
  const spec = roundTypeSpec(round.type);
  // Seeded by position so each round in a loop shows a different example, and
  // so the example does not reshuffle on every keystroke in a controlled form.
  const example = exampleQuestionForRoundType(round.type, index);
  const playbook = selectRoundPlaybook(round.type);

  const ids = {
    type: `round-${round.id}-type`,
    title: `round-${round.id}-title`,
    length: `round-${round.id}-length`,
    focus: `round-${round.id}-focus`,
    persona: `round-${round.id}-persona`,
    code: `round-${round.id}-code`,
  };

  return (
    <Card>
      <CardHeader>
        {/* The round's tag, in its round colour, beside the title. Three
            rounds in a loop used to render as three identical white cards;
            the tag makes the type legible before you read a word, and it is
            the same chip the landing page and the loop chain above use. */}
        <CardTitle className="flex flex-wrap items-center gap-2.5 text-lg">
          {isLoop ? `Round ${index + 1} of ${total}` : "Your round"}
          <span
            className={cn(
              "inline-flex h-6 items-center rounded-md px-2 font-sans text-xs font-semibold tracking-normal",
              TILE_COLORS[spec.accent],
            )}
          >
            {spec.label}
          </span>
        </CardTitle>
        {onRemove && (
          <CardAction>
            {/* In the overflow menu, matching the persona cards. It used to be
                a trash icon sitting directly above every field it destroys. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Actions for round ${index + 1}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onSelect={onRemove}>
                  Remove round
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        )}
      </CardHeader>

      {/* The decisions first, the reference last. Type and length decide what
          the round is and how long it runs, so they share the first row;
          focus and title are what you type; the example question and the
          interviewer's instructions are there to read, so they fold away.
          This was three titled sections and a permanently open reference
          block, which made one round card taller than the screen. */}
      <CardContent className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            label="Type"
            htmlFor={ids.type}
            hint={
              // The criteria the analyzer actually scores this round on.
              <div className="flex flex-wrap gap-1.5">
                {rubricCriteria(round.type).map((criterion) => (
                  <Badge
                    key={criterion}
                    variant="secondary"
                    className="font-normal"
                  >
                    {criterion}
                  </Badge>
                ))}
              </div>
            }
          >
            <Select
              value={round.type}
              onValueChange={(next) =>
                onChange(applyRoundType(round, next as InterviewRoundType))
              }
            >
              <SelectTrigger id={ids.type} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROUND_TYPE_LABELS).map(([type, label]) => (
                  <SelectItem key={type} value={type}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Length"
            htmlFor={ids.length}
            aside={
              <span className="text-xs text-slate-500 tabular-nums">
                {describeRoundLength(round.durationMinutes)}
              </span>
            }
          >
            <div className="flex h-9 items-center">
              <input
                id={ids.length}
                type="range"
                min={5}
                max={90}
                step={5}
                value={round.durationMinutes}
                onChange={(event) =>
                  onChange({ durationMinutes: Number(event.target.value) })
                }
                className="w-full accent-primary"
              />
            </div>
          </Field>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Focus" htmlFor={ids.focus}>
            <Input
              id={ids.focus}
              value={round.focus}
              onChange={(event) => onChange({ focus: event.target.value })}
              placeholder="What this round should dig into"
            />
          </Field>
          <Field label="Title" htmlFor={ids.title}>
            <Input
              id={ids.title}
              value={round.title}
              onChange={(event) => onChange({ title: event.target.value })}
            />
          </Field>
        </div>

        {/* A different interviewer per round is only a concept in a loop — a
            single round already has the Interviewer step. */}
        {isLoop && (
          <Field label="Asked by" htmlFor={ids.persona}>
            <Select
              value={round.personaLibraryId ?? "default"}
              onValueChange={(next) =>
                onChange({
                  personaLibraryId: next === "default" ? undefined : next,
                })
              }
            >
              <SelectTrigger id={ids.persona} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Same as default</SelectItem>
                {personaLibrary.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {entry.config.name} · {entry.config.seniority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}

        {/* Gated on the round type alone. A voice technical round can take
            typed code; it just opens on discussion. */}
        {supportsCodeEditor(round.type) && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 p-3">
            <div>
              <Label htmlFor={ids.code}>Answer in a code editor</Label>
              <p className="mt-0.5 text-xs text-slate-500">
                {round.practiceMode === "voice"
                  ? "You still speak; the editor is there for the code."
                  : "Technical answers open in the editor."}
              </p>
            </div>
            <Switch
              id={ids.code}
              checked={resolveAnswerFormat(round) === "code"}
              onCheckedChange={(checked) =>
                onChange({ answerFormat: checked ? "code" : "prose" })
              }
            />
          </div>
        )}

        {/* What the round is actually like, from existing data: the question
            comes from the drill bank, and the instruction is verbatim what
            this round's playbook tells the interviewer, so the preview cannot
            drift from what the session does. */}
        {(example || playbook) && (
          <details className="group border-t border-slate-100 pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-slate-900 [&::-webkit-details-marker]:hidden">
              What this round is like
              <ChevronDown
                className="h-4 w-4 text-slate-500 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                aria-hidden
              />
            </summary>
            <div className="mt-2 space-y-4">
              {example && (
                <div className="space-y-1">
                  <p className={PANEL_LABEL}>A question it might ask</p>
                  <p className="text-sm leading-6 text-slate-900">
                    &ldquo;{example}&rdquo;
                  </p>
                </div>
              )}
              {playbook && (
                <div className="space-y-1">
                  <p className={PANEL_LABEL}>How the interviewer runs it</p>
                  <p className="text-sm leading-6 text-slate-600">
                    {playbook.content}
                  </p>
                </div>
              )}
            </div>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
