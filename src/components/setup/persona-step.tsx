"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Dice5,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import type { CommunicationStyle, PersonaConfig } from "@/lib/persona-engine";
import {
  findEntryMatchingConfig,
  type PersonaLibraryEntry,
} from "@/lib/persona-library";

/**
 * Interviewer step of the setup wizard: pick a saved persona, or shape one.
 *
 * Extracted from `setup/page.tsx`, which held eight components plus the launch
 * orchestration and microphone permission handling across 1,796 lines. This
 * piece is self-contained — it takes a persona and a library and reports edits
 * back — so it was the clearest seam to cut along.
 */

const COMMUNICATION_STYLE_OPTIONS: Array<{
  value: CommunicationStyle;
  label: string;
  description: string;
}> = [
  {
    value: "direct",
    label: "Direct",
    description: "Fast, candid, and to the point",
  },
  {
    value: "diplomatic",
    label: "Diplomatic",
    description: "Tactful with measured pushback",
  },
  {
    value: "collaborative",
    label: "Collaborative",
    description: "Warm, supportive, and exploratory",
  },
  {
    value: "analytical",
    label: "Analytical",
    description: "Structured, evidence-driven, and precise",
  },
];

function buildPresetSummary(persona: PersonaConfig): string {
  return `${persona.seniority} • ${persona.industry}`;
}

export function PersonaStep({
  value,
  activeLibraryId,
  library,
  isLoading,
  onPatch,
  onPick,
  onRandomize,
  onSaveAsNew,
  onUpdateLibraryEntry,
  onDuplicate,
  onDelete,
  onResetLibrary,
}: {
  value: PersonaConfig;
  activeLibraryId: string | undefined;
  library: PersonaLibraryEntry[];
  isLoading: boolean;
  onPatch: (patch: Partial<PersonaConfig>) => void;
  onPick: (entry: PersonaLibraryEntry) => void;
  onRandomize: () => void;
  onSaveAsNew: (name?: string) => void;
  onUpdateLibraryEntry: (entryId: string) => void;
  onDuplicate: (entryId: string) => void;
  onDelete: (entryId: string) => void;
  onResetLibrary: () => void;
}) {
  const sortedLibrary = useMemo(() => {
    // Show user-created personas first (most recent first), then presets in
    // their seeded order so the "onboarding guides" stay visually stable.
    return [...library].sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "user" ? -1 : 1;
      if (a.kind === "user") return b.updatedAt - a.updatedAt;
      return a.updatedAt - b.updatedAt;
    });
  }, [library]);

  const matchedEntry = useMemo(
    () => findEntryMatchingConfig(value, library),
    [library, value],
  );

  const matchedEntryId = matchedEntry?.id ?? null;
  const isModified = activeLibraryId
    ? matchedEntryId !== activeLibraryId
    : matchedEntryId === null;

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState(value.name);
  const [showSaveAsNew, setShowSaveAsNew] = useState(false);

  const handlePickEntry = (entry: PersonaLibraryEntry) => {
    onPick(entry);
    setRenameDraft(entry.config.name);
    setShowSaveAsNew(false);
    setPendingDeleteId(null);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-blue-100/80 bg-blue-50/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Persona library</Label>
            <p className="text-xs text-gray-600">
              Pick a starting point — the built-in presets are just an
              onboarding guide, you can edit, rename, duplicate, or delete any
              of them.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRandomize}
              className="gap-1.5"
            >
              <Dice5 className="h-3.5 w-3.5" />
              Randomize
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onResetLibrary}
              className="gap-1.5 text-gray-600 hover:text-gray-900"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore presets
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {isLoading && sortedLibrary.length === 0
            ? [0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-2xl bg-gray-100"
                />
              ))
            : null}
          {sortedLibrary.map((entry) => {
            const isActive =
              activeLibraryId === entry.id ||
              (!activeLibraryId && matchedEntryId === entry.id);
            const isPendingDelete = pendingDeleteId === entry.id;

            return (
              <div
                key={entry.id}
                className={`group relative flex h-full flex-col gap-2 rounded-2xl border p-3 text-left transition-all duration-200 ${
                  isActive
                    ? "border-blue-300 bg-white shadow-soft-md"
                    : "border-gray-200/80 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handlePickEntry(entry)}
                  className="flex flex-1 flex-col gap-2 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900">
                          {entry.config.name}
                        </p>
                        <Badge
                          variant={entry.kind === "user" ? "default" : "outline"}
                          className="rounded-full text-[10px] capitalize"
                        >
                          {entry.kind === "user" ? "Yours" : "Preset"}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        {buildPresetSummary(entry.config)}
                      </p>
                    </div>
                    <Badge
                      variant="secondary"
                      className="rounded-full text-[10px] capitalize"
                    >
                      {entry.config.communicationStyle}
                    </Badge>
                  </div>
                  <p className="text-[11px] leading-5 text-gray-600">
                    {entry.config.nationality} • Strict {entry.config.strictness}
                    /10 • Warm {entry.config.warmth}/10 • Pace{" "}
                    {entry.config.pace ?? 5}/10 • Pushback{" "}
                    {entry.config.pushback ?? 5}/10
                  </p>
                </button>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    {isActive && (
                      <span className="inline-flex items-center gap-1 text-blue-700">
                        <CheckCircle2 className="h-3 w-3" />
                        Selected
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-500 hover:text-blue-600"
                      title="Duplicate"
                      aria-label={`Duplicate ${entry.config.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onDuplicate(entry.id);
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-gray-500 hover:text-blue-600"
                      title="Edit"
                      aria-label={`Edit ${entry.config.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        handlePickEntry(entry);
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={`h-7 w-7 ${
                        isPendingDelete
                          ? "text-red-600 bg-red-50"
                          : "text-gray-500 hover:text-red-600"
                      }`}
                      title={isPendingDelete ? "Confirm delete" : "Delete"}
                      aria-label={
                        isPendingDelete
                          ? `Confirm delete ${entry.config.name}`
                          : `Delete ${entry.config.name}`
                      }
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isPendingDelete) {
                          onDelete(entry.id);
                          setPendingDeleteId(null);
                        } else {
                          setPendingDeleteId(entry.id);
                        }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {pendingDeleteId && (
          <p className="mt-3 text-[11px] text-red-600">
            Click the trash icon again to confirm delete, or pick another
            persona to cancel.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-gray-200/80 bg-white/70 p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Label className="text-sm font-medium">Customize</Label>
            <p className="text-xs text-gray-500">
              Tweak the interviewer to match the role you are practicing for.
              {isModified && activeLibraryId
                ? " Unsaved changes from the original."
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="rounded-full text-[11px]">
              {value.name}
            </Badge>
            {activeLibraryId && isModified && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => onUpdateLibraryEntry(activeLibraryId)}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Update saved
              </Button>
            )}
            <Button
              type="button"
              variant="default"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setRenameDraft(value.name);
                setShowSaveAsNew((current) => !current);
              }}
            >
              <Save className="h-3.5 w-3.5" />
              {showSaveAsNew ? "Cancel" : "Save as new"}
            </Button>
          </div>
        </div>

        {showSaveAsNew && (
          <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl border border-blue-200/70 bg-blue-50/60 p-3">
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label className="text-xs">Name your persona</Label>
              <Input
                value={renameDraft}
                onChange={(event) => setRenameDraft(event.target.value)}
                placeholder={value.name}
              />
            </div>
            <Button
              type="button"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                onSaveAsNew(renameDraft);
                setShowSaveAsNew(false);
              }}
              disabled={renameDraft.trim().length === 0}
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </Button>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Display name</Label>
            <Input
              value={value.name}
              onChange={(event) => onPatch({ name: event.target.value })}
              placeholder="e.g. Adaptive Interviewer"
            />
          </div>
          <div className="space-y-2">
            <Label>Nationality</Label>
            <Input
              value={value.nationality}
              onChange={(event) => onPatch({ nationality: event.target.value })}
              placeholder="e.g. Japanese"
            />
          </div>
          <div className="space-y-2">
            <Label>Industry</Label>
            <Input
              value={value.industry}
              onChange={(event) => onPatch({ industry: event.target.value })}
              placeholder="e.g. Healthcare"
            />
          </div>
          <div className="space-y-2">
            <Label>Seniority</Label>
            <Input
              value={value.seniority}
              onChange={(event) => onPatch({ seniority: event.target.value })}
              placeholder="e.g. Director of Product"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Communication style</Label>
            <Select
              value={value.communicationStyle}
              onValueChange={(nextStyle) =>
                onPatch({ communicationStyle: nextStyle as CommunicationStyle })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMUNICATION_STYLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              {COMMUNICATION_STYLE_OPTIONS.find(
                (option) => option.value === value.communicationStyle,
              )?.description}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Years of experience</Label>
            <Input
              type="number"
              min={1}
              max={40}
              value={value.yearsExperience}
              onChange={(event) =>
                onPatch({
                  yearsExperience: Math.max(
                    1,
                    Math.min(40, Number(event.target.value) || 1),
                  ),
                })
              }
            />
          </div>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <SliderField
            label="Strictness"
            value={value.strictness}
            helper="Higher means more demanding and less forgiving."
            onChange={(next) =>
              onPatch({ strictness: next as PersonaConfig["strictness"] })
            }
          />
          <SliderField
            label="Warmth"
            value={value.warmth}
            helper="Higher means more encouraging and supportive."
            onChange={(next) => onPatch({ warmth: next as PersonaConfig["warmth"] })}
          />
          <SliderField
            label="Pace"
            value={value.pace ?? 5}
            helper="Higher means faster, less breathing room between questions."
            onChange={(next) => onPatch({ pace: next as PersonaConfig["pace"] })}
          />
          <SliderField
            label="Pushback"
            value={value.pushback ?? 5}
            helper="Higher means more skepticism — challenges claims and probes for evidence."
            onChange={(next) =>
              onPatch({ pushback: next as PersonaConfig["pushback"] })
            }
          />
        </div>
      </div>
    </div>
  );
}

function SliderField({
  label,
  value,
  helper,
  onChange,
}: {
  label: string;
  value: number;
  helper: string;
  onChange: (next: number) => void;
}) {
  // A <Label> with no `htmlFor` next to an <input> with no `id` is decoration:
  // it looks associated and is not. Wiring them means the four persona dials
  // are actually reachable and announced.
  const id = `dial-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        <Badge variant="secondary" className="text-xs px-2 py-0.5">
          {value}/10
        </Badge>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        aria-valuetext={`${value} out of 10`}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-blue-600"
      />
      <p className="text-xs text-gray-500">{helper}</p>
    </div>
  );
}
