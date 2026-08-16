"use client";

import { useState } from "react";
import { CheckCircle2, FileUser, Trash2 } from "lucide-react";
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
import { Field, fieldHintId } from "@/components/ui/field";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { UseResumes } from "@/hooks/use-resumes";
import { PdfDropZone } from "@/components/ui/pdf-drop-zone";
import type { ResumeSetupConfig, ResumeSetupMode } from "@/lib/interview-setup";

const TAB_OPTIONS: Array<{ id: ResumeSetupMode; label: string }> = [
  { id: "paste", label: "Paste text" },
  { id: "upload", label: "Upload PDF" },
  { id: "saved", label: "From library" },
];

interface ResumePickerProps {
  value: ResumeSetupConfig;
  onChange: (next: ResumeSetupConfig) => void;
  /**
   * The wizard's single CV library. Mounted by `SetupWizard` and passed down,
   * never a second `useResumes()` here — two owners of one mutable list is what
   * made adding a job description in the wizard disable Continue.
   */
  library: UseResumes;
}

export function ResumePicker({ value, onChange, library }: ResumePickerProps) {
  const { items, status, error, uploadPdf, remove } = library;
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    value.mode === "upload" ? value.savedTitle : null,
  );

  const setMode = (mode: ResumeSetupMode) => {
    onChange({
      ...value,
      mode,
      savedId: mode === "paste" ? null : value.savedId,
      savedTitle: mode === "paste" ? null : value.savedTitle,
    });
  };

  const handleSelectFile = async (file: File) => {
    setUploading(true);
    setUploadedFileName(file.name);
    const created = await uploadPdf({ file });
    setUploading(false);
    if (created) {
      onChange({
        ...value,
        mode: "upload",
        savedId: created.id,
        savedTitle: created.title,
        rawText: "",
      });
    } else {
      setUploadedFileName(null);
    }
  };

  const handlePickSaved = (id: string, title: string) => {
    onChange({
      ...value,
      mode: "saved",
      savedId: id,
      savedTitle: title,
      rawText: "",
    });
  };

  const handleRemoveSaved = async (id: string) => {
    const ok = await remove(id);
    if (ok && value.savedId === id) {
      onChange({ ...value, savedId: null, savedTitle: null });
    }
  };

  return (
    // Structurally identical to the job-description picker on purpose: same
    // card, same header-as-toggle, same rhythm. The two differ only where the
    // data does (no role title here).
    <Card className="border border-border shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileUser className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Label htmlFor="use-resume">CV</Label>
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
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Where it comes from
            </p>
            <div className="flex flex-wrap gap-2">
              {TAB_OPTIONS.map((tab) => (
                <ChoiceChip
                  key={tab.id}
                  selected={value.mode === tab.id}
                  onClick={() => setMode(tab.id)}
                >
                  {tab.label}
                </ChoiceChip>
              ))}
            </div>
          </div>

          {value.mode === "paste" && (
            <Field
              label="Paste resume"
              htmlFor="resume-text"
              aside={
                <span className="text-xs tabular-nums text-muted-foreground">
                  {value.rawText.trim().length} chars
                </span>
              }
              hint={
                value.rawText.trim().length > 0 &&
                value.rawText.trim().length < 80 ? (
                  <span className="text-destructive">
                    Paste at least 80 characters to enable resume context.
                  </span>
                ) : undefined
              }
            >
              <Textarea
                id="resume-text"
                aria-describedby={fieldHintId("resume-text")}
                placeholder="Paste your experience, skills, education, and projects here..."
                value={value.rawText}
                onChange={(event) =>
                  onChange({ ...value, rawText: event.target.value })
                }
                className="min-h-40 resize-y"
              />
            </Field>
          )}

          {value.mode === "upload" &&
            (value.savedId ? (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-white p-3">
                {/* The upload row replaces the drop zone the instant the parse
                    lands, which read as a glitch; the tick now arrives on its
                    own so the success is legible as an event. */}
                <CheckCircle2 className="h-5 w-5 text-emerald-500 animate-in zoom-in-50 duration-300 ease-soft" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {value.savedTitle ?? "Uploaded resume"}
                  </p>
                  <p className="text-xs text-muted-foreground">Ready to use</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUploadedFileName(null)}
                >
                  Replace
                </Button>
              </div>
            ) : (
              <PdfDropZone
                onSelect={(file) => void handleSelectFile(file)}
                busy={uploading}
                busyLabel={
                  uploadedFileName
                    ? `Uploading ${uploadedFileName}...`
                    : "Uploading..."
                }
                label="Upload a PDF resume"
                hint="Scanned or image-only PDFs won't work — we can only read PDFs with selectable text."
              />
            ))}

          {value.mode === "saved" && (
            <div className="space-y-2">
              {status === "loading" && items.length === 0 ? (
                <div className="space-y-2">
                  {[0, 1].map((index) => (
                    <Skeleton key={index} className="h-16 bg-muted" />
                  ))}
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-muted p-4 text-center">
                  <p className="text-sm font-medium text-gray-800">
                    No saved resumes yet
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Switch to &quot;Paste text&quot; or &quot;Upload PDF&quot;
                    to add one.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => {
                    const isActive = value.savedId === item.id;
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                          isActive
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-border bg-white hover:bg-muted"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handlePickSaved(item.id, item.title)}
                          className="flex-1 text-left"
                        >
                          <p className="text-sm font-medium text-foreground">
                            {item.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </p>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveSaved(item.id)}
                          aria-label="Delete resume"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
