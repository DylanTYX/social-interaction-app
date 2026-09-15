"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronDown,
  Dice5,
  MoreHorizontal,
  RefreshCw,
  Save,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyStateCard } from "@/components/dashboard/empty-state-card";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { PersonaGridSkeleton } from "@/components/dashboard/page-skeletons";
import { PersonaCard } from "@/components/persona/persona-card";
import { PersonaConfigEditor } from "@/components/persona/persona-config-editor";
import { PERSONA_DIALS } from "@/components/persona/dial-field";
import {
  QUESTIONING_STYLE_META,
  type PersonaConfig,
} from "@/lib/persona-engine";
import {
  findEntryMatchingConfig,
  personaConfigEquals,
  personaIdentityComplete,
  sortPersonaLibrary,
  type PersonaLibraryEntry,
} from "@/lib/persona-library";

/**
 * Interviewer step of the setup wizard: pick a saved persona, or shape one.
 *
 * The contract with `/dashboard/personas` (docs/FEATURES.md): the wizard
 * *chooses* and, optionally, *tweaks* for this session; the library *manages*.
 * So the card, the editor, the copy and the sort order are the library's —
 * shared components, not lookalikes — while delete and restore-presets live
 * only in the library, reached by the same "Manage in library" link the job
 * description and resume pickers carry. Before this the step had its own
 * card (four dials, no style, no voice), its own editor (no traits, hardcoded
 * style copy, a 1–40 years clamp that silently rewrote library values) and a
 * "Update saved" button that could never render.
 */
export function PersonaStep({
  value,
  activeLibraryId,
  library,
  status,
  error,
  onRetry,
  onPatch,
  onPick,
  onRandomize,
  onSaveAsNew,
  onUpdateLibraryEntry,
  onDuplicate,
}: {
  value: PersonaConfig;
  activeLibraryId: string | undefined;
  library: PersonaLibraryEntry[];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  onRetry: () => void;
  onPatch: (patch: Partial<PersonaConfig>) => void;
  onPick: (entry: PersonaLibraryEntry) => void;
  onRandomize: () => void;
  onSaveAsNew: (name?: string) => void;
  onUpdateLibraryEntry: (entryId: string) => void;
  onDuplicate: (entryId: string) => void;
}) {
  const sortedLibrary = useMemo(() => sortPersonaLibrary(library), [library]);

  const activeEntry = useMemo(
    () => library.find((entry) => entry.id === activeLibraryId) ?? null,
    [library, activeLibraryId],
  );
  const matchedEntry = useMemo(
    () => findEntryMatchingConfig(value, library),
    [library, value],
  );

  /**
   * Modified means "differs from the entry it came from", field for field.
   * The old test compared ids from a matcher that ignored years, traits,
   * boundaries and interests — and the page cleared the id on every
   * keystroke anyway, so this could never be true while the id was set.
   */
  const isModified = activeEntry
    ? !personaConfigEquals(value, activeEntry.config)
    : false;
  const selectedId = activeLibraryId ?? matchedEntry?.id ?? null;

  const [renameDraft, setRenameDraft] = useState(value.name);
  const [showSaveAsNew, setShowSaveAsNew] = useState(false);
  const canSave = personaIdentityComplete(value);

  const handlePickEntry = (entry: PersonaLibraryEntry) => {
    onPick(entry);
    setRenameDraft(entry.config.name);
    setShowSaveAsNew(false);
  };

  const styleLabel =
    QUESTIONING_STYLE_META[value.questioningStyle ?? "conversational"].label;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pick an interviewer</CardTitle>
          <CardDescription>
            Your library, as it is on the personas page. Pick one to use as-is,
            or tweak it below for this session.
          </CardDescription>
          <CardAction>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRandomize}
              >
                <Dice5 />
                Randomize
              </Button>
              {/* Delete and restore-presets live in the library. Keeping them
                  out of here is what keeps this step a picker — and it is the
                  same link the job-description and resume pickers carry. */}
              <Link
                href="/dashboard/personas"
                className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Manage in library
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent>
          {status === "loading" && library.length === 0 ? (
            <PersonaGridSkeleton count={6} />
          ) : status === "error" ? (
            <ErrorStateCard
              title="Couldn't load your personas"
              description={error ?? "Something went wrong."}
              onRetry={onRetry}
            />
          ) : sortedLibrary.length === 0 ? (
            <EmptyStateCard
              title="No personas yet"
              description="Randomize one to start from, or build your roster in the library."
              primaryAction={{ label: "Randomize one", onClick: onRandomize }}
              secondaryAction={{
                label: "Manage in library",
                href: "/dashboard/personas",
              }}
            />
          ) : (
            <div>
              {/* The page scrolls; an inner scroller inside the page scroller
                  was two scrollbars for one list. */}
              {/* Two across: the step shares its width with the summary
                  panel, and a persona card needs room for its dials. */}
              <div className="grid gap-4 sm:grid-cols-2">
                {sortedLibrary.map((entry) => (
                  <PersonaCard
                    key={entry.id}
                    entry={entry}
                    selected={selectedId === entry.id}
                    onSelect={() => handlePickEntry(entry)}
                    menu={
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            aria-label={`Actions for ${entry.config.name}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          align="end"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          {/* Duplicate is a workflow move — fork a preset to
                              tweak it. Delete is management, so it is not
                              here. */}
                          <DropdownMenuItem
                            onSelect={() => onDuplicate(entry.id)}
                          >
                            Duplicate
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            Customise this interviewer
            {isModified && (
              <Badge
                variant="outline"
                className="font-normal text-muted-foreground"
              >
                Unsaved changes
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Tweaks apply to this session. Save them to reuse the interviewer.
          </CardDescription>
          <CardAction>
            <div className="flex flex-wrap items-center gap-2">
              {activeEntry && isModified && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canSave}
                  onClick={() => onUpdateLibraryEntry(activeEntry.id)}
                >
                  <RefreshCw />
                  Update saved
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setRenameDraft(value.name);
                  setShowSaveAsNew((current) => !current);
                }}
              >
                <Save />
                {showSaveAsNew ? "Cancel" : "Save as new"}
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-6">
          {showSaveAsNew && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-50 flex-1 space-y-2">
                <Label htmlFor="persona-save-name">Name your persona</Label>
                <Input
                  id="persona-save-name"
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  placeholder={value.name}
                />
              </div>
              {/* Same rule as the library's Save: the server refuses a persona
                  without its four identity fields, so refuse here. */}
              <Button
                type="button"
                onClick={() => {
                  onSaveAsNew(renameDraft);
                  setShowSaveAsNew(false);
                }}
                disabled={renameDraft.trim().length === 0 || !canSave}
              >
                Save
              </Button>
            </div>
          )}

          {/* The library's editor, collapsed. Picking a preset needs no
              editing, so the step ends at the picker by default; open this
              and every section, control and hint is the library's — the same
              component, not a lookalike. The summary keeps the collapsed
              state honest by showing what it hides. */}
          <details className="group border-t border-slate-100 pt-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-slate-900">
              <span className="min-w-0">
                Edit details
                <span className="ml-2 truncate text-xs font-normal text-muted-foreground">
                  {styleLabel} ·{" "}
                  {PERSONA_DIALS.map(
                    (dial) =>
                      `${dial.label.split(" ")[0]} ${value[dial.key] ?? 5}`,
                  ).join(" · ")}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
            </summary>
            <div className="mt-6">
              <PersonaConfigEditor value={value} onChange={onPatch} />
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
