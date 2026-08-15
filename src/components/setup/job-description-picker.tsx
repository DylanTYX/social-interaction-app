"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Eye, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
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
import { Field, fieldHintId } from "@/components/ui/field";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useJobDescriptions,
  type JobDescriptionSummary,
  type JobDescriptionUsage,
} from "@/hooks/use-job-descriptions";
import { TidyJobDescription } from "@/components/setup/tidy-job-description";
import { PdfDropZone } from "@/components/ui/pdf-drop-zone";
import { JobDescriptionPreviewDialog } from "@/components/dashboard/job-description-preview-dialog";
import { describeJobDescriptionDelete } from "@/lib/job-description-copy";
import { cn } from "@/lib/utils";
import type { JobDescriptionSetupConfig } from "@/lib/interview-setup";

interface JobDescriptionPickerProps {
  value: JobDescriptionSetupConfig;
  onChange: (next: JobDescriptionSetupConfig) => void;
}

/**
 * Choose the job description this interview runs against.
 *
 * Two verbs, not three modes. This used to offer "Paste text", "Upload PDF" and
 * "From library" as peers, which mixed *creating* a job description with
 * *selecting* one — and once `savedId` was set the mode stopped mattering, so
 * the states could contradict each other. Picking a saved job description and
 * then clicking the "Upload PDF" chip produced a green tick, that job
 * description's title, the words "Embedded and ready to use" and a **Replace**
 * button, for a PDF that had never existed. Launch could not tell the
 * difference either, so it started cleanly.
 *
 * Now: either a job description is selected, or you are choosing one. Adding a
 * new one — by paste or by PDF — saves it to the library and selects it, so it
 * lands in exactly the state picking from the library would have produced.
 * There is one library and this is a view onto it; the wizard never holds a
 * private copy.
 */
export function JobDescriptionPicker({
  value,
  onChange,
}: JobDescriptionPickerProps) {
  const { items, status, error, uploadText, uploadPdf, remove, countUsage } =
    useJobDescriptions();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<JobDescriptionSummary | null>(
    null,
  );
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingUsage, setPendingUsage] = useState<
    JobDescriptionUsage | null | undefined
  >(undefined);
  const usageRequestRef = useRef(0);

  const selected = items.find((item) => item.id === value.savedId) ?? null;
  /**
   * Whether the add panel is showing, when nothing is selected yet.
   *
   * Starts open only for a user with an empty library — there is nothing to
   * choose from, so offering the choice first would be a dead end.
   */
  const [adding, setAdding] = useState(false);
  const showAdd = adding || (status === "ready" && items.length === 0);

  const select = (item: JobDescriptionSummary) => {
    setAdding(false);
    setFormError(null);
    onChange({
      ...value,
      savedId: item.id,
      savedTitle: item.title,
      // Copied onto the config so they reach `launch_meta` and, through it, the
      // interviewer's prompt.
      company: item.company ?? "",
      roleTitle: item.roleTitle ?? "",
      // A selection and a draft cannot both be live; see the normalizer.
      rawText: "",
    });
  };

  const clearSelection = () => {
    onChange({ ...value, savedId: null, savedTitle: null, rawText: "" });
  };

  const handleSavePaste = async () => {
    setFormError(null);
    if (value.rawText.trim().length < 80) {
      setFormError("Paste at least 80 characters of the job description.");
      return;
    }
    setBusy(true);
    const created = await uploadText({
      rawText: value.rawText,
      roleTitle: value.roleTitle.trim() || null,
      company: value.company.trim() || null,
      sourceUrl: value.sourceUrl.trim() || null,
    });
    setBusy(false);
    if (created) select(created);
  };

  const handleSelectFile = async (file: File) => {
    setFormError(null);
    setBusy(true);
    const created = await uploadPdf({
      file,
      roleTitle: value.roleTitle.trim() || null,
      company: value.company.trim() || null,
      sourceUrl: value.sourceUrl.trim() || null,
    });
    setBusy(false);
    if (created) select(created);
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
        <CardContent className="space-y-6">
          {selected ? (
            /* Resolved. One job description, named, with a way to read it and a
               way to change your mind — and nothing that implies this screen
               can edit it, because it cannot. */
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
          ) : showAdd ? (
            <AddPanel
              value={value}
              onChange={onChange}
              busy={busy}
              onSavePaste={handleSavePaste}
              onSelectFile={handleSelectFile}
              onCancel={items.length > 0 ? () => setAdding(false) : undefined}
            />
          ) : (
            <SavedList
              items={items}
              loading={status === "loading" && items.length === 0}
              onSelect={select}
              onPreview={setPreviewing}
              onDelete={openDeleteDialog}
              onAdd={() => setAdding(true)}
            />
          )}

          {(formError || error) && (
            <p className="text-xs text-destructive" role="alert">
              {formError ?? error}
            </p>
          )}
        </CardContent>
      )}

      <JobDescriptionPreviewDialog
        item={previewing}
        onOpenChange={(open) => {
          if (!open) setPreviewing(null);
        }}
      />

      {/* The same guarded dialog the library page uses. Deleting from the
          wizard used to remove a job description outright on one click, with no
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

/** Pick one of the saved job descriptions, or start adding a new one. */
function SavedList({
  items,
  loading,
  onSelect,
  onPreview,
  onDelete,
  onAdd,
}: {
  items: JobDescriptionSummary[];
  loading: boolean;
  onSelect: (item: JobDescriptionSummary) => void;
  onPreview: (item: JobDescriptionSummary) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1].map((index) => (
          <Skeleton key={index} className="h-16 bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="group flex items-center gap-2 rounded-lg border border-border bg-white p-3 transition-colors duration-150 hover:bg-accent"
          >
            <button
              type="button"
              onClick={() => onSelect(item)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-sm font-medium text-foreground">
                {item.title}
              </p>
              {/* Company first, matching the library page — it is what tells
                  two postings for one role apart. Joined from present parts so
                  a missing one does not leave a stranded separator. */}
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
              onClick={() => onPreview(item)}
              aria-label={`Preview ${item.title}`}
            >
              <Eye className="h-4 w-4 text-muted-foreground" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              onClick={() => onDelete(item.id)}
              aria-label={`Delete ${item.title}`}
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" onClick={onAdd}>
        Add a new job description
      </Button>
    </div>
  );
}

/**
 * Create a job description and select it.
 *
 * Paste saves on an explicit action rather than at launch. Deferring it meant
 * launching twice from the same draft created two identical rows and paid for
 * two chunk-and-embed runs, because the id was never written back into the
 * saved setup — so the wizard had no idea a row already existed.
 */
function AddPanel({
  value,
  onChange,
  busy,
  onSavePaste,
  onSelectFile,
  onCancel,
}: {
  value: JobDescriptionSetupConfig;
  onChange: (next: JobDescriptionSetupConfig) => void;
  busy: boolean;
  onSavePaste: () => void;
  onSelectFile: (file: File) => void;
  onCancel?: () => void;
}) {
  // "saved" is a legacy value from the three-mode era; it is not an add-method.
  const method = value.mode === "upload" ? "upload" : "paste";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <ChoiceChip
            selected={method === "paste"}
            onClick={() => onChange({ ...value, mode: "paste" })}
          >
            Paste text
          </ChoiceChip>
          <ChoiceChip
            selected={method === "upload"}
            onClick={() => onChange({ ...value, mode: "upload" })}
          >
            Upload PDF
          </ChoiceChip>
        </div>
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Use a saved one
          </Button>
        )}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Company" htmlFor="jd-company">
          <Input
            id="jd-company"
            placeholder="e.g. Monzo"
            value={value.company}
            onChange={(event) =>
              onChange({ ...value, company: event.target.value })
            }
          />
        </Field>
        <Field label="Applied role title" htmlFor="role-title">
          <Input
            id="role-title"
            placeholder="e.g. Product Manager Intern"
            value={value.roleTitle}
            onChange={(event) =>
              onChange({ ...value, roleTitle: event.target.value })
            }
          />
        </Field>
      </div>

      {/* Was collected nowhere and posted anyway, so every job description
          created from the wizard stored an empty source URL. */}
      <Field label="Link to the posting" htmlFor="jd-source-url">
        <Input
          id="jd-source-url"
          type="url"
          inputMode="url"
          placeholder="https://..."
          value={value.sourceUrl}
          onChange={(event) =>
            onChange({ ...value, sourceUrl: event.target.value })
          }
        />
      </Field>

      {method === "paste" ? (
        <div className="space-y-4">
          <Field
            label="Paste job description"
            htmlFor="job-description-text"
            aside={
              <span className="text-xs tabular-nums text-muted-foreground">
                {value.rawText.trim().length} chars
              </span>
            }
            hint={
              value.rawText.trim().length > 0 &&
              value.rawText.trim().length < 80 ? (
                <span className="text-destructive">
                  Paste at least 80 characters to enable JD context.
                </span>
              ) : undefined
            }
          >
            <Textarea
              id="job-description-text"
              aria-describedby={fieldHintId("job-description-text")}
              placeholder="Paste responsibilities, requirements, qualifications, and company context here..."
              value={value.rawText}
              onChange={(event) =>
                onChange({ ...value, rawText: event.target.value })
              }
              className="min-h-40 resize-y"
            />
          </Field>

          <TidyJobDescription
            rawText={value.rawText}
            onApply={(result) =>
              onChange({
                ...value,
                rawText: result.cleanedText,
                // Filled in only, never overwritten: what the user typed beats
                // what was inferred from the page.
                company: value.company || (result.company ?? ""),
                roleTitle: value.roleTitle || (result.roleTitle ?? ""),
              })
            }
          />

          <Button type="button" onClick={onSavePaste} disabled={busy}>
            {busy ? "Saving..." : "Save and use"}
          </Button>
        </div>
      ) : (
        <PdfDropZone
          onSelect={onSelectFile}
          busy={busy}
          label="Upload a PDF job description"
          hint="Text is extracted and embedded automatically. Image-only PDFs are not supported in this version."
        />
      )}

      {/* Stated because it is otherwise a surprise: the wizard writes to the
          library, and the row outlives this session whether or not it is ever
          launched. */}
      <p className={cn("text-xs text-muted-foreground")}>
        Saved to your library, so you can reuse it in later interviews.
      </p>
    </div>
  );
}
