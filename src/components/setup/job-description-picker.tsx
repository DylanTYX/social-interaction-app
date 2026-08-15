"use client";

import { useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Eye, FileText, Trash2 } from "lucide-react";

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
import { describeJobDescriptionDelete } from "@/lib/job-description-copy";
import type {
  JobDescriptionSummary,
  JobDescriptionUsage,
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
  const { items, status, error, refresh, remove, countUsage } = library;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<JobDescriptionDraft>(emptyDraft);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const [previewing, setPreviewing] = useState<JobDescriptionSummary | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingUsage, setPendingUsage] = useState<
    JobDescriptionUsage | null | undefined
  >(undefined);
  const usageRequestRef = useRef(0);

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
    // Only asks when there is something worth losing; below that a dialog would
    // just be in the way. Same threshold logic as the drills page's guard.
    if (draft.text.trim().length >= DRAFT_WORTH_KEEPING_CHARS) {
      setDiscardPrompt(true);
      return;
    }
    closeAddDialog();
  };

  const openDeleteDialog = (id: string) => {
    const requestId = usageRequestRef.current + 1;
    usageRequestRef.current = requestId;
    setPendingDelete(id);
    setPendingUsage(undefined);
    void countUsage(id).then((usage) => {
      if (usageRequestRef.current === requestId) setPendingUsage(usage);
    });
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
          ) : selected ? (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {selected.title}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[selected.company, selected.roleTitle]
                    .filter(Boolean)
                    .join(" · ") || "Saved in your library"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setPreviewing(selected)}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSelection}
              >
                Change
              </Button>
            </div>
          ) : status === "loading" && items.length === 0 ? (
            <div className="space-y-2">
              {[0, 1].map((index) => (
                <Skeleton key={index} className="h-16 bg-muted" />
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
                  No saved job descriptions yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="group flex items-center gap-2 rounded-lg border border-border bg-white p-3 transition-colors duration-150 hover:bg-accent"
                    >
                      <button
                        type="button"
                        onClick={() => select(item)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.title}
                        </p>
                        {/* Company first, matching the library page — it is
                            what tells two postings for one role apart. */}
                        <p className="truncate text-xs text-muted-foreground">
                          {[
                            item.company,
                            item.roleTitle,
                            new Date(item.createdAt).toLocaleDateString(),
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => setPreviewing(item)}
                        aria-label={`Preview ${item.title}`}
                      >
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={() => openDeleteDialog(item.id)}
                        aria-label={`Delete ${item.title}`}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAdding(true)}
              >
                Add a new job description
              </Button>
            </div>
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
            error={creator.error}
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

      {/* The same guarded dialog the library page uses. Deleting from the
          wizard used to remove a job description on one click, with no
          confirmation and no word about the interviews still using it. */}
      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setPendingUsage(undefined);
          }
        }}
        title="Delete this job description?"
        description={describeJobDescriptionDelete(pendingUsage)}
        onConfirm={async () => {
          const targetId = pendingDelete;
          setPendingDelete(null);
          if (!targetId) return;
          const ok = await remove(targetId);
          if (ok && value.savedId === targetId) clearSelection();
        }}
      />
    </Card>
  );
}
