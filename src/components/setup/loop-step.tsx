"use client";

import { useState } from "react";
import { MoreHorizontal, Plus, Sparkles } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { describeRoundLength } from "@/lib/interview-progress";
import { supportsCodeEditor } from "@/lib/round-types";
import {
  appendRoundToLoop,
  createLoopFromTemplate,
  removeRoundFromLoop,
  applyRoundType,
  SINGLE_ROUND,
  resolveAnswerFormat,
  ROUND_RUBRIC_LABELS,
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
    label: "Quick practice",
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Start from
        </span>
        {PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant="outline"
            size="sm"
            className="h-8 rounded-full text-xs"
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
            className="h-8 gap-1.5 rounded-full text-xs"
            onClick={() =>
              applyPreset(
                suggestLoopFromJobDescription(jobDescriptionText, practiceMode),
              )
            }
          >
            <Sparkles className="h-3.5 w-3.5" />
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

      <div className="space-y-3">
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
          className="gap-1.5"
          onClick={() => onChange(appendRoundToLoop(value, practiceMode))}
        >
          <Plus className="h-3.5 w-3.5" />
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

  const ids = {
    type: `round-${round.id}-type`,
    title: `round-${round.id}-title`,
    length: `round-${round.id}-length`,
    focus: `round-${round.id}-focus`,
    persona: `round-${round.id}-persona`,
    code: `round-${round.id}-code`,
  };

  return (
    <Card className="border border-border shadow-soft">
      <CardHeader>
        <CardTitle className="text-base">
          {isLoop ? `Round ${index + 1} of ${total}` : "Your session"}
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

      {/* Grouped by concern rather than laid out in one flat grid. Previously
          identity (type, title) was split across three non-adjacent cells with
          shape (length) wedged between, and because it was a single
          `sm:grid-cols-2`, Title sat beside Type on desktop but beside Length
          on mobile — the grouping was a side-effect of the column count. */}
      <CardContent className="space-y-6">
        <section className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            What kind of round
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={ids.type}>Type</Label>
              <Select
                value={round.type}
                onValueChange={(next) =>
                  onChange(applyRoundType(round, next as InterviewRoundType))
                }
              >
                <SelectTrigger id={ids.type}>
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
              <p className="text-xs leading-4 text-muted-foreground">
                Scored on {ROUND_RUBRIC_LABELS[round.type].toLowerCase()}.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={ids.title}>Title</Label>
              <Input
                id={ids.title}
                value={round.title}
                onChange={(event) => onChange({ title: event.target.value })}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Shape
          </h4>
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <Label htmlFor={ids.length}>Length</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {describeRoundLength(round.durationMinutes)}
              </span>
            </div>
            {/* Boxed to 36px so the slider shares a baseline with the inputs
                above it — a bare range is ~19px tall. */}
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
                className="w-full accent-blue-600"
              />
            </div>
          </div>

          {supportsCodeEditor(round.type) && round.practiceMode === "text" && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <Label htmlFor={ids.code}>Answer in a code editor</Label>
              <Switch
                id={ids.code}
                checked={resolveAnswerFormat(round) === "code"}
                onCheckedChange={(checked) =>
                  onChange({ answerFormat: checked ? "code" : "prose" })
                }
              />
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Content
          </h4>
          <div className="space-y-2">
            <Label htmlFor={ids.focus}>Focus</Label>
            <Input
              id={ids.focus}
              value={round.focus}
              onChange={(event) => onChange({ focus: event.target.value })}
              placeholder="What this round should dig into"
            />
          </div>

          {/* A different interviewer per round is only a concept in a loop — a
              single round already has the Interviewer step. */}
          {isLoop && (
            <div className="space-y-2">
              <Label htmlFor={ids.persona}>Asked by</Label>
              <Select
                value={round.personaLibraryId ?? "default"}
                onValueChange={(next) =>
                  onChange({
                    personaLibraryId: next === "default" ? undefined : next,
                  })
                }
              >
                <SelectTrigger id={ids.persona}>
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
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
