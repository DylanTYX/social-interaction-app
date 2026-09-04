"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  Eye,
  FileUser,
  Plus,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { describeTruncationBadge } from "@/lib/document-truncation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import {
  DRAFT_WORTH_KEEPING_CHARS,
  emptyResumeDraft,
  ResumeAddForm,
  useResumeCreator,
  type ResumeDraft,
} from "@/components/dashboard/resume-add-form";
import { ResumePreviewDialog } from "@/components/dashboard/resume-preview-dialog";
import { cn } from "@/lib/utils";
import type { ResumeSummary, UseResumes } from "@/hooks/use-resumes";
import type { ResumeSetupConfig } from "@/lib/interview-setup";

/**
 * Choose the resume this interview runs against.
 *
 * The job description picker's twin, down to the layout — same rows, same radio
 * dot, same preview eye, same add dialog, same "Manage in library" link. Two
 * cards sitting one above the other in the same step have no business behaving
 * differently, and this one used to: three mode chips, a paste box, an upload
 * panel and a delete button, inside a card whose job is to answer one question.
 *
 * That difference was not only cosmetic. Pasting here created a *new* resume at
 * every launch, so launching twice from one draft left duplicate rows; the
 * delete button removed a library document from inside the wizard with no
 * confirmation and no idea what used it; and the "From library" tab's empty
 * state told you to go and click one of the other tabs, which is a card
 * describing its own emptiness rather than resolving it.
 *
 * The library it renders is passed in rather than fetched here. Mounting a
 * second `useResumes()` alongside the wizard's own gives the page and this card
 * separate copies of a mutable list — that is what made adding a job
 * description in the wizard disable Continue, and it would have been
 * reintroduced here verbatim.
 */
export function ResumePicker({
  value,
  onChange,
  library,
}: {
  value: ResumeSetupConfig;
  onChange: (next: ResumeSetupConfig) => void;
  /** The wizard's single library instance. */
  library: UseResumes;
}) {
  const { items, status, error, refresh } = library;

  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<ResumeDraft>(emptyResumeDraft);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const [previewing, setPreviewing] = useState<ResumeSummary | null>(null);

  /**
   * Local filter, deliberately not the hook's server-side `query`: the hook
   * instance is shared with the wizard's launch gate, and a server query that
   * filtered the selected item out of `items` would trip the
   * "no longer in your library" warning on a document that is still there.
   * The list is capped at 50, so client-side is exact anyway.
   */
  const [listQuery, setListQuery] = useState("");

  const visibleItems = listQuery.trim()
    ? items.filter((item) =>
        [item.title, item.variant]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(listQuery.trim().toLowerCase()),
      )
    : items;

  const creator = useResumeCreator(library);

  const selected = items.find((item) => item.id === value.savedId) ?? null;
  /**
   * The chosen resume is gone — deleted from the library page while this `savedId`
   * sat in localStorage.
   *
   * Only meaningful once the library has actually loaded. Deriving it from
   * `status === "ready"` rather than from `items.length` keeps a failed load
   * from looking like a deletion.
   */
  const selectionMissing =
    status === "ready" && Boolean(value.savedId) && selected === null;

  const select = (item: ResumeSummary) => {
    onChange({
      ...value,
      mode: "saved",
      savedId: item.id,
      savedTitle: item.title,
      rawText: "",
    });
  };

  const clearSelection = () => {
    onChange({ ...value, savedId: null, savedTitle: null, rawText: "" });
  };

  const closeAddDialog = () => {
    setAdding(false);
    setDraft(emptyResumeDraft());
    creator.setError(null);
  };

  const requestCloseAddDialog = () => {
    // The label counts too — in Upload mode there is never any text, so a guard
    // that only looked there would throw away a typed label without asking.
    const hasDraft =
      draft.text.trim().length >= DRAFT_WORTH_KEEPING_CHARS ||
      Boolean(draft.label.trim());
    if (hasDraft) {
      setDiscardPrompt(true);
      return;
    }
    closeAddDialog();
  };

  const handleCreated = (created: ResumeSummary | null) => {
    if (!created) return;
    // Ends in exactly the state picking from the list would have produced.
    select(created);
    closeAddDialog();
  };

  return (
    <Card className="border border-border shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileUser className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Label htmlFor="use-resume">Resume</Label>
          <Badge variant="outline" className="font-normal">
            Optional
          </Badge>
        </CardTitle>
        <CardDescription>
          Lets the interviewer ask about your actual experience and projects.
        </CardDescription>
        <CardAction>
          <Switch
            id="use-resume"
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
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-warning-border bg-warning-subtle/70 p-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-warning" />
              <p className="flex-1 text-xs text-warning-emphasis">
                The resume you had chosen is no longer in your library. Pick
                another one, or turn this off.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-warning-emphasis hover:bg-warning-muted"
                onClick={clearSelection}
              >
                Dismiss
              </Button>
            </div>
          )}

          {status === "error" ? (
            /* Never an empty list on a failed load. Rendering "add your first
               one" to someone with several saved resumes invites a duplicate
               upload, and hides a selection launch would still have used. */
            <ErrorStateCard
              title="Couldn't load your resumes"
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
            <>
              {/* Hidden until there is enough to search — the same rule the
                library pages apply to their own toolbars. */}
              {items.length > 5 && (
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={listQuery}
                    onChange={(event) => setListQuery(event.target.value)}
                    placeholder="Search title or version..."
                    aria-label="Search saved resumes"
                    className="pl-9"
                  />
                </div>
              )}
              <div
                className={cn(
                  // Capped and scrolled so the height comes from the container
                  // rather than from how many resumes happen to be saved, and so
                  // choosing one never resizes the card.
                  "max-h-64 space-y-2 overflow-y-auto",
                  items.length > 0 && "pr-1",
                )}
              >
                {visibleItems.map((item) => {
                  const isActive = item.id === value.savedId;
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "group flex items-center gap-3 rounded-lg border p-3 transition-colors duration-150",
                        isActive
                          ? "border-primary bg-primary-subtle"
                          : "border-border bg-white hover:bg-accent",
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
                              ? "border-primary bg-primary"
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
                                ? "font-medium text-primary-emphasis"
                                : "text-foreground",
                            )}
                          >
                            {item.title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {[
                              item.variant ||
                                new Date(item.createdAt).toLocaleDateString(),
                              describeTruncationBadge(item.truncatedFrom),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
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

                {items.length > 0 && visibleItems.length === 0 && (
                  <p className="px-1 py-3 text-center text-xs text-muted-foreground">
                    Nothing matches that search.
                  </p>
                )}

                {items.length === 0 && (
                  /* The message and the way out of it, together and centred. The
                   old empty state described the emptiness and then sent you to
                   a different tab to resolve it. */
                  <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/40 px-6 py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      No saved resumes yet
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setAdding(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Add a resume
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex items-center justify-between gap-3">
            {/* Once the list speaks for itself the label is redundant, so this
                shrinks to an icon. Never conditional on *selection* though —
                that is what makes a card resize as you choose. It changes only
                when the library goes from empty to not, which happens once. */}
            {items.length > 0 ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setAdding(true)}
                    aria-label="Add a resume"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add a resume</TooltipContent>
              </Tooltip>
            ) : (
              <span />
            )}

            {/* Editing, renaming and deleting live in the library. Keeping them
                out of here is what lets this card be one list — and the delete
                that used to live here removed a document the user could have
                been halfway through an interview with. */}
            <Link
              href="/dashboard/resumes"
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
            <DialogTitle>Add a resume</DialogTitle>
            <DialogDescription>
              Saved to your library, so you can reuse it in later interviews.
              The text is sent to OpenAI to generate questions, so don&apos;t
              include anything you wouldn&apos;t want sent to a third party.
            </DialogDescription>
          </DialogHeader>

          <ResumeAddForm
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
        title="Discard this resume?"
        description="You have text here that has not been saved. Closing now loses it."
        confirmLabel="Discard"
        onConfirm={() => {
          setDiscardPrompt(false);
          closeAddDialog();
        }}
      />

      <ResumePreviewDialog
        item={previewing}
        onOpenChange={(open) => {
          if (!open) setPreviewing(null);
        }}
      />
    </Card>
  );
}
