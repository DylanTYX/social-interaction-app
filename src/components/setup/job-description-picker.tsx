"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Eye, FileText, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import {
  DRAFT_WORTH_KEEPING_CHARS,
  emptyDraft,
  JobDescriptionAddForm,
  useJobDescriptionCreator,
  type JobDescriptionDraft,
} from "@/components/dashboard/job-description-add-form";
import { JobDescriptionPreviewDialog } from "@/components/dashboard/job-description-preview-dialog";
import { cn } from "@/lib/utils";
import type {
  JobDescriptionSummary,
  UseJobDescriptions,
} from "@/hooks/use-job-descriptions";
import type { JobDescriptionSetupConfig } from "@/lib/interview-setup";

/**
 * Choose the job description this interview runs against.
 *
 * A chooser, and only a chooser. It shows either the document you have picked
 * or the list to pick from; adding a new one opens a dialog. Nothing swaps in
 * place, which is the whole design — the previous version put a create form
 * inside this card and the consequences were not cosmetic:
 *
 *   - The card held `company` and `roleTitle` for the form it hosted, and
 *     deselecting did not clear them, so Change → Add pre-filled the *previous*
 *     employer. The new document was mislabelled and the interviewer was
 *     briefed with the wrong company.
 *   - Selecting a document wiped an in-progress paste with no warning, and a
 *     draft restored from storage was invisible until you reopened the panel.
 *   - The branch that warned about a deleted selection sat *before* the one
 *     that showed the add panel, so "Add a new job description" did nothing at
 *     all while that warning was up.
 *
 * The library it renders is passed in rather than fetched here. Mounting a
 * second `useJobDescriptions()` alongside the wizard's own gave the page and
 * this card separate copies of a mutable list: adding a document updated one of
 * them, and the launch gate read the other, so creating a job description in
 * the wizard disabled Continue until a full reload.
 */
export function JobDescriptionPicker({
  value,
  onChange,
  library,
}: {
  value: JobDescriptionSetupConfig;
  onChange: (next: JobDescriptionSetupConfig) => void;
  /** The wizard's single library instance. */
  library: UseJobDescriptions;
}) {
  const { items, status, error, refresh } = library;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<JobDescriptionDraft>(emptyDraft);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const [previewing, setPreviewing] = useState<JobDescriptionSummary | null>(
    null,
  );

  const creator = useJobDescriptionCreator(library);

  const selected = items.find((item) => item.id === value.savedId) ?? null;
  /**
   * The chosen job description is gone — deleted from the library page while
   * this `savedId` sat in localStorage.
   *
   * Only meaningful once the library has actually loaded. Deriving it from
   * `status === "ready"` rather than from `items.length` keeps a failed load
   * from looking like a deletion.
   */
  const selectionMissing =
    status === "ready" && Boolean(value.savedId) && selected === null;

  const select = (item: JobDescriptionSummary) => {
    onChange({
      ...value,
      savedId: item.id,
      savedTitle: item.title,
      // Kept for the launch snapshot, but no longer the source of truth —
      // `launchInterview` re-reads these from the library row so a rename on
      // the library page cannot leave the interviewer briefed on a stale name.
      company: item.company ?? "",
      roleTitle: item.roleTitle ?? "",
      rawText: "",
    });
  };

  const clearSelection = () => {
    onChange({
      ...value,
      savedId: null,
      savedTitle: null,
      // Cleared together. Leaving these behind is what let one document's
      // employer end up on the next one created.
      company: "",
      roleTitle: "",
      rawText: "",
    });
  };

  const closeAddDialog = () => {
    setAdding(false);
    setDraft(emptyDraft());
    creator.setError(null);
  };

  const requestCloseAddDialog = () => {
    // Every field, not just the pasted text — in Upload mode there is never any
    // text, so a guard that only looked there would throw away a typed company,
    // role title and posting URL without asking. Still only asks when there is
    // something worth losing; below that a dialog is just in the way.
    const hasDraft =
      draft.text.trim().length >= DRAFT_WORTH_KEEPING_CHARS ||
      Boolean(draft.company.trim()) ||
      Boolean(draft.roleTitle.trim()) ||
      Boolean(draft.sourceUrl.trim());
    if (hasDraft) {
      setDiscardPrompt(true);
      return;
    }
    closeAddDialog();
  };

  const handleCreated = (created: JobDescriptionSummary | null) => {
    if (!created) return;
    // Ends in exactly the state picking from the list would have produced.
    select(created);
    closeAddDialog();
  };

  return (
    <Card className="border border-border shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Label htmlFor="use-jd">Job description</Label>
          <Badge variant="outline" className="font-normal">
            Optional
          </Badge>
        </CardTitle>
        <CardDescription>
          Grounds the questions in the actual role rather than a generic one.
        </CardDescription>
        <CardAction>
          <Switch
            id="use-jd"
            checked={value.enabled}
            onCheckedChange={(checked) =>
              onChange({ ...value, enabled: checked })
            }
          />
        </CardAction>
      </CardHeader>

      {value.enabled && (
        <CardContent className="space-y-4">
          {selectionMissing && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
              <p className="flex-1 text-xs text-amber-900">
                The job description you had chosen is no longer in your library.
                Pick another one, or turn this off.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-amber-900 hover:bg-amber-100"
                onClick={clearSelection}
              >
                Dismiss
              </Button>
            </div>
          )}

          {status === "error" ? (
            /* Never an empty list on a failed load. Rendering "add your first
               one" to someone with twenty saved documents invites a duplicate
               paste, and hides a selection that launch would still have used. */
            <ErrorStateCard
              title="Couldn't load your job descriptions"
              description={error ?? "Something went wrong."}
              onRetry={() => void refresh()}
            />
          ) : status === "loading" && items.length === 0 ? (
            <div className="space-y-2">
              {[0, 1].map((index) => (
                <Skeleton key={index} className="h-14 bg-muted" />
              ))}
            </div>
          ) : (
            /**
             * One persistent list. Choosing moves the dot and changes nothing
             * else — no panel swaps in for the list, no button appears or
             * disappears, so the card does not resize as you make up your mind.
             * That was the complaint, and it came from rendering a one-line
             * "chosen" panel in place of an N-row list.
             *
             * Capped and scrollable so the height is set by the container
             * rather than by how many documents you happen to have saved.
             */
            <div
              className={cn(
                "max-h-64 divide-y divide-border overflow-y-auto rounded-lg border",
                // Dashed when there is nothing in it, matching how every other
                // empty state in the app is drawn.
                items.length === 0
                  ? "border-dashed border-border bg-muted/40"
                  : "border-border",
              )}
            >
              {items.map((item) => {
                const isActive = item.id === value.savedId;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group flex items-center gap-3 p-3 transition-colors duration-150",
                      isActive ? "bg-blue-50/70" : "bg-white hover:bg-accent",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => select(item)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      aria-pressed={isActive}
                    >
                      {/* A radio, not a tick: these are alternatives, and only
                          one of them can be in play. */}
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
                          isActive
                            ? "border-blue-600 bg-blue-600"
                            : "border-slate-300 bg-white",
                        )}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-sm",
                            isActive
                              ? "font-medium text-blue-900"
                              : "text-foreground",
                          )}
                        >
                          {item.title}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[item.company, item.roleTitle]
                            .filter(Boolean)
                            .join(" · ") ||
                            new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      onClick={() => setPreviewing(item)}
                      aria-label={`Preview ${item.title}`}
                    >
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                );
              })}

              {items.length === 0 && (
                /* The message and the way out of it, together and centred.
                   An empty box that only *describes* the emptiness makes you
                   hunt elsewhere for the fix. */
                <div className="flex flex-col items-center justify-center gap-3 px-6 py-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    No saved job descriptions yet
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setAdding(true)}
                  >
                    <Plus className="h-4 w-4" />
                    Add a job description
                  </Button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            {/* Once the list speaks for itself the label is redundant, so this
                shrinks to an icon. Never conditional on *selection* though —
                that is what made the card resize as you chose. It changes only
                when the library goes from empty to not, which happens once.

                Labelled through the tooltip and `aria-label` rather than left
                to be guessed: a bare glyph is only honest when the surrounding
                context already says what it adds, and it still has to say so to
                a screen reader. */}
            {items.length > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setAdding(true)}
                    aria-label="Add a job description"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add a job description</TooltipContent>
              </Tooltip>
            ) : (
              <span />
            )}

            {/* Editing, renaming and deleting live in the library. Keeping
                them out of here is what lets this card be one list. */}
            <Link
              href="/dashboard/job-descriptions"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors duration-150 hover:text-foreground"
            >
              Manage in library
              <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Mutation failures — a rejected upload — are written to the
              library-level error, which the branch above only renders when the
              *load* failed. Without this they were silent. */}
          {status !== "error" && error && !adding && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      )}

      <Dialog
        open={adding}
        onOpenChange={(open) => {
          if (!open) requestCloseAddDialog();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader className="text-left">
            <DialogTitle>Add a job description</DialogTitle>
            <DialogDescription>
              Saved to your library, so you can reuse it in later interviews.
            </DialogDescription>
          </DialogHeader>

          <JobDescriptionAddForm
            draft={draft}
            onDraftChange={setDraft}
            busy={creator.busy}
            // `creator.error` is only the client-side length check; every
            // server failure lands on the library-level error. Both, or an
            // image-only PDF fails in silence.
            error={creator.error ?? error}
            submitLabel="Save and use"
            onSubmitText={async () =>
              handleCreated(await creator.submitText(draft))
            }
            onSubmitFile={async (file) =>
              handleCreated(await creator.submitFile(draft, file))
            }
          />
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={discardPrompt}
        onOpenChange={(open) => {
          if (!open) setDiscardPrompt(false);
        }}
        title="Discard this job description?"
        description="You have text here that has not been saved. Closing now loses it."
        confirmLabel="Discard"
        onConfirm={() => {
          setDiscardPrompt(false);
          closeAddDialog();
        }}
      />

      <JobDescriptionPreviewDialog
        item={previewing}
        onOpenChange={(open) => {
          if (!open) setPreviewing(null);
        }}
      />
    </Card>
  );
}
