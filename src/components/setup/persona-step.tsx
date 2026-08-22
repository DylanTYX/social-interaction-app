"use client";

import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Dice5,
  HelpCircle,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  Save,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldSection } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { cn } from "@/lib/utils";
import {
  isQuestioningStyle,
  type CommunicationStyle,
  type PersonaConfig,
} from "@/lib/persona-engine";
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
  const pendingEntry = library.find((entry) => entry.id === pendingDeleteId);
  const [renameDraft, setRenameDraft] = useState(value.name);
  const [showSaveAsNew, setShowSaveAsNew] = useState(false);

  const handlePickEntry = (entry: PersonaLibraryEntry) => {
    onPick(entry);
    setRenameDraft(entry.config.name);
    setShowSaveAsNew(false);
    setPendingDeleteId(null);
  };

  return (
    // Picker above editor, both full width.
    //
    // This was `lg:grid-cols-2`, which halved the page and then let the persona
    // grid halve it again — so on a 1440px screen one persona card came out at
    // 201px while the *same card* was 319px at 768px, where `lg:` is off. The
    // narrowest tile in the app, on the widest screens, carrying the most text.
    //
    // Picking an interviewer is this step's job; editing one is refinement, so
    // the split was giving half the width to the secondary task. Stacking also
    // ends the height mismatch the columns created — roughly 1096px of library
    // against 504px of editor, leaving ~590px of dead space — which an earlier
    // comment here claimed was solved by scrolling the library inside its card.
    // It was not: there was no `overflow` or `max-h` anywhere in this file. See
    // the picker grid below, where that now actually exists.
    <div className="space-y-6">
      <Card className="border border-border shadow-soft">
        <CardHeader>
          <CardTitle className="text-base">Pick an interviewer</CardTitle>
          <CardAction>
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
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restore presets
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Three across, matching `/dashboard/personas`, which renders this
              same `PersonaConfig` data. 293px per card against 201px before —
              enough that "Isabella Rodriguez" stops truncating.

              The height cap is what the old root-level comment claimed already
              existed. Two rows of cards come to ~656px so the shipped six never
              scroll; it only engages once "Save as new" and "Duplicate" have
              grown a library past that, which nothing caps. */}
          <div className="max-h-[52rem] overflow-y-auto pr-1">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {isLoading && sortedLibrary.length === 0
                ? [0, 1, 2, 3, 4, 5].map((index) => (
                    <Skeleton key={index} className="h-72 bg-muted" />
                  ))
                : null}
              {sortedLibrary.map((entry) => {
                const isActive =
                  activeLibraryId === entry.id ||
                  (!activeLibraryId && matchedEntryId === entry.id);

                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "group relative flex flex-col gap-4 rounded-lg border p-4 text-left transition-all duration-200",
                      isActive
                        ? "border-primary bg-primary-subtle ring-2 ring-primary/20"
                        : "border-border hover:border-primary-border hover:bg-accent",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => handlePickEntry(entry)}
                      className="flex h-full flex-col gap-4 text-left"
                    >
                      {/* Identity: every fact about *who they are*, in one
                        cluster attached to the avatar, descending in weight as
                        it gets less identifying — name, role, then context.

                        Seniority and industry used to sit down in the behaviour
                        block one line above "Traits:", which rendered a
                        credential and a personality trait at the same size,
                        colour and weight. The card read as five equivalent grey
                        lines with no seam between who someone is and how they
                        interview.

                        The initials avatar is what makes six presets tellable
                        apart without reading; its colour derives from the name,
                        so it survives the library re-sorting after every save. */}
                      <div className="flex items-center gap-3 pr-8">
                        <div className="relative shrink-0">
                          <InitialsAvatar name={entry.config.name} />
                          {/* Selection lands on the avatar rather than in the
                            dial row below, where it stole ~70px and made the
                            four dials reflow the moment you picked a persona. */}
                          {isActive && (
                            <span
                              className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary ring-2 ring-white"
                              aria-hidden
                            >
                              <Check className="h-2.5 w-2.5 text-white" />
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {entry.config.name}
                            {isActive && (
                              <span className="sr-only"> (selected)</span>
                            )}
                          </p>
                          <p className="truncate text-xs text-foreground/70">
                            {entry.config.seniority}
                          </p>
                          <p className="truncate text-[11px] leading-4 tracking-wide text-muted-foreground">
                            {entry.config.nationality} · {entry.config.industry}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={
                            entry.kind === "user" ? "default" : "outline"
                          }
                          className="capitalize"
                        >
                          {entry.kind === "user" ? "Yours" : "Preset"}
                        </Badge>
                        <Badge variant="secondary" className="capitalize">
                          {entry.config.communicationStyle}
                        </Badge>
                      </div>
                      {/* Third group: what this interviewer is actually like.
                        Traits and boundaries are already sent to the model —
                        `buildBoundaries` tells the interviewer to be vocal when
                        one comes up — but the person choosing had no way to
                        know that. Knowing Sarah Chen is impatient with vagueness
                        is exactly what makes the choice meaningful. */}
                      <div className="space-y-2">
                        {/* Traits and dislikes are the same *kind* of thing —
                          a short descriptive list drawn from a ~20-string pool —
                          so they get the same treatment. Traits were briefly
                          badges, which was wrong twice over: it made two
                          equivalent fields look unequal, and it put five pills
                          on a 293px card when the only two that had earned pill
                          shape were the ones above.

                          The rule, applied consistently: a pill means a value
                          from a small closed set you could filter by — "Preset"
                          or "Yours", one of four communication styles. Anything
                          free-text is text. */}
                        {entry.config.personalityTraits.length > 0 && (
                          <p className="text-xs leading-5 text-muted-foreground">
                            <span className="font-medium text-foreground">
                              Traits:
                            </span>{" "}
                            {entry.config.personalityTraits
                              .slice(0, 3)
                              .join(", ")}
                          </p>
                        )}

                        {entry.config.boundaries.length > 0 && (
                          <p className="text-xs leading-5 text-muted-foreground">
                            <span className="font-medium text-foreground">
                              Dislikes:
                            </span>{" "}
                            {entry.config.boundaries.slice(0, 3).join(", ")}
                          </p>
                        )}
                      </div>

                      {/* The dials, as data rather than a fourth sentence. They
                        are the fields that actually drive behaviour — strictness
                        and warmth reach `estimateFollowupDifficulty`, pace sets
                        the speaking rate — so they get their own row at the foot
                        of the card instead of trailing the prose.

                        `mt-auto` pins them to the bottom, so across a row of
                        cards the dials line up regardless of how long anyone's
                        traits are. */}
                      {/* Full width, always. Sharing this row with a "Selected"
                        label meant the four dials reflowed and wrapped the
                        instant a card was picked — the layout moved as a
                        side-effect of selecting, which is exactly when you are
                        looking at it. Selection is the ring plus the avatar
                        check now, neither of which occupies flow. */}
                      <div className="mt-auto pt-2">
                        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums">
                          {[
                            ["Strict", entry.config.strictness],
                            ["Warm", entry.config.warmth],
                            ["Pace", entry.config.pace ?? 5],
                            ["Pushback", entry.config.pushback ?? 5],
                          ].map(([label, value]) => (
                            <div
                              key={label}
                              className="flex items-baseline gap-1"
                            >
                              <dt className="text-muted-foreground">{label}</dt>
                              <dd className="font-medium text-foreground">
                                {value}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    </button>

                    {/* Top right, absolutely positioned, because that is where
                      `CardAction` puts an overflow menu everywhere else in this
                      app — the persona editor, the round card, the document
                      pickers. At the bottom it sat beside a *status*, which read
                      as though the two were related.

                      Outside the card's <button> so it is not a button in a
                      button; `stopPropagation` keeps opening the menu from also
                      selecting the persona. */}
                    <div className="absolute right-2 top-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground"
                            aria-label={`Actions for ${entry.config.name}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => onDuplicate(entry.id)}
                          >
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => setPendingDeleteId(entry.id)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <ConfirmDeleteDialog
            open={pendingDeleteId !== null}
            onOpenChange={(open) => {
              if (!open) setPendingDeleteId(null);
            }}
            title="Delete this persona?"
            description={
              pendingEntry
                ? `"${pendingEntry.config.name}" will be removed from your library. Interviews already run with it are unaffected.`
                : ""
            }
            onConfirm={() => {
              if (pendingDeleteId) onDelete(pendingDeleteId);
              setPendingDeleteId(null);
            }}
          />
        </CardContent>
      </Card>

      <Card className="border border-border shadow-soft">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Customise
            {isModified && activeLibraryId && (
              <Badge
                variant="outline"
                className="font-normal text-muted-foreground"
              >
                Unsaved changes
              </Badge>
            )}
          </CardTitle>
          <CardAction>
            <div className="flex flex-wrap items-center gap-2">
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
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-8">
          {showSaveAsNew && (
            <div className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-muted p-3">
              <div className="flex-1 min-w-[200px] space-y-2">
                <Label htmlFor="persona-save-name" className="text-xs">
                  Name your persona
                </Label>
                <Input
                  id="persona-save-name"
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

          {/* These eight fields were two unlabelled grids. Every `Label` here
              was also unwired — no `htmlFor`, no `id` — so clicking a label did
              nothing and a screen reader announced eight bare inputs. */}
          <FieldSection title="Who they are">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Display name" htmlFor="persona-name">
                <Input
                  id="persona-name"
                  value={value.name}
                  onChange={(event) => onPatch({ name: event.target.value })}
                  placeholder="e.g. Adaptive Interviewer"
                />
              </Field>
              <Field label="Nationality" htmlFor="persona-nationality">
                <Input
                  id="persona-nationality"
                  value={value.nationality}
                  onChange={(event) =>
                    onPatch({ nationality: event.target.value })
                  }
                  placeholder="e.g. Japanese"
                />
              </Field>
              <Field label="Industry" htmlFor="persona-industry">
                <Input
                  id="persona-industry"
                  value={value.industry}
                  onChange={(event) =>
                    onPatch({ industry: event.target.value })
                  }
                  placeholder="e.g. Healthcare"
                />
              </Field>
              <Field label="Seniority" htmlFor="persona-seniority">
                <Input
                  id="persona-seniority"
                  value={value.seniority}
                  onChange={(event) =>
                    onPatch({ seniority: event.target.value })
                  }
                  placeholder="e.g. Director of Product"
                />
              </Field>
            </div>
          </FieldSection>

          <FieldSection title="How they interview">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Field
                className="lg:col-span-3"
                label="Communication style"
                htmlFor="persona-style"
                hint={
                  COMMUNICATION_STYLE_OPTIONS.find(
                    (option) => option.value === value.communicationStyle,
                  )?.description
                }
              >
                <Select
                  value={value.communicationStyle}
                  onValueChange={(nextStyle) =>
                    onPatch({
                      communicationStyle: nextStyle as CommunicationStyle,
                    })
                  }
                >
                  <SelectTrigger id="persona-style" className="w-full">
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
              </Field>

              <Field label="Years of experience" htmlFor="persona-years">
                <Input
                  id="persona-years"
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
              </Field>
            </div>
          </FieldSection>

          {/* Four sliders that default to a neutral 5 and that most people never
            touch. Collapsed, so the step ends at the fields that actually
            need answering. The summary line on each library card and the
            review step both still show the values. */}
          <details className="group rounded-lg border border-border bg-muted p-3">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-foreground">
              <span>
                Fine-tune interviewer style
                <span className="ml-2 font-normal text-xs text-muted-foreground">
                  Strict {value.strictness} · Warm {value.warmth} · Pace{" "}
                  {value.pace ?? 5} · Pushback {value.pushback ?? 5} · Probing{" "}
                  {value.probingDepth ?? 5} · Curveballs{" "}
                  {value.unpredictability ?? 5}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            {/* Layer 3 before Layer 4: choose how the interview is conducted,
                then fine-tune the dials inside that choice. `communicationStyle`
                lives on the card above because it is voice; this is conduct. */}
            <div className="mt-6 space-y-2">
              <Label className="text-sm">Questioning style</Label>
              <Select
                value={value.questioningStyle ?? "conversational"}
                onValueChange={(next) =>
                  onPatch({
                    questioningStyle: isQuestioningStyle(next)
                      ? next
                      : "conversational",
                  })
                }
              >
                <SelectTrigger className="w-full sm:w-96">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conversational">
                    Conversational — natural discussion, picks up your threads
                  </SelectItem>
                  <SelectItem value="supportive">
                    Supportive — room to think, clarifies, never pressures
                  </SelectItem>
                  <SelectItem value="socratic">
                    Socratic — answers with the next question
                  </SelectItem>
                  <SelectItem value="deep_dive">
                    Deep Dive — one thread, drilled to the bottom
                  </SelectItem>
                  <SelectItem value="bar_raiser">
                    Bar Raiser — evidence required for every claim
                  </SelectItem>
                  <SelectItem value="stress">
                    Stress — pressure on, reassurance off
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
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
                onChange={(next) =>
                  onPatch({ warmth: next as PersonaConfig["warmth"] })
                }
              />
              <SliderField
                label="Pace"
                value={value.pace ?? 5}
                helper="Higher means faster, less breathing room between questions."
                onChange={(next) =>
                  onPatch({ pace: next as PersonaConfig["pace"] })
                }
              />
              <SliderField
                label="Pushback"
                value={value.pushback ?? 5}
                helper="Higher means more skepticism — challenges claims and probes for evidence."
                onChange={(next) =>
                  onPatch({ pushback: next as PersonaConfig["pushback"] })
                }
              />
              <SliderField
                label="Probing depth"
                value={value.probingDepth ?? 5}
                helper="Higher means every vague claim — 'helped with', 'we decided' — gets a follow-up."
                onChange={(next) =>
                  onPatch({
                    probingDepth: next as PersonaConfig["probingDepth"],
                  })
                }
              />
              <SliderField
                label="Unpredictability"
                value={value.unpredictability ?? 5}
                helper="Higher means more curveballs — topic pivots and what-if twists on your own scenario."
                onChange={(next) =>
                  onPatch({
                    unpredictability: next as PersonaConfig["unpredictability"],
                  })
                }
              />
            </div>
          </details>
        </CardContent>
      </Card>
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
        <div className="flex items-center gap-1.5">
          <Label htmlFor={id}>{label}</Label>
          {/* The one place a tooltip earns its keep in this flow: "higher means
              more skepticism" is real explanation, not a restated label. It is
              also the kind of detail you want once and never again, which is
              exactly what hover-to-reveal is for.

              `aria-describedby` carries the same text to screen readers and to
              anyone who reaches the slider by keyboard, so the explanation is
              never hover-only. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`What does ${label.toLowerCase()} do?`}
                className="text-muted-foreground hover:text-muted-foreground"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-56">{helper}</TooltipContent>
          </Tooltip>
        </div>
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
        aria-describedby={`${id}-help`}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
      />
      <span id={`${id}-help`} className="sr-only">
        {helper}
      </span>
    </div>
  );
}
