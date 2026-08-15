"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileText, Trash2, Upload } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useJobDescriptions } from "@/hooks/use-job-descriptions";
import { TidyJobDescription } from "@/components/setup/tidy-job-description";
import type {
  JobDescriptionSetupConfig,
  JobDescriptionSetupMode,
} from "@/lib/interview-setup";

const TAB_OPTIONS: Array<{ id: JobDescriptionSetupMode; label: string }> = [
  { id: "paste", label: "Paste text" },
  { id: "upload", label: "Upload PDF" },
  { id: "saved", label: "From library" },
];

interface JobDescriptionPickerProps {
  value: JobDescriptionSetupConfig;
  onChange: (next: JobDescriptionSetupConfig) => void;
}

export function JobDescriptionPicker({
  value,
  onChange,
}: JobDescriptionPickerProps) {
  const { items, status, error, uploadPdf, remove } = useJobDescriptions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(
    value.mode === "upload" ? value.savedTitle : null,
  );

  const setMode = (mode: JobDescriptionSetupMode) => {
    onChange({
      ...value,
      mode,
      // Clear references when leaving the saved/upload modes so the user
      // does not accidentally launch with stale state.
      savedId: mode === "paste" ? null : value.savedId,
      savedTitle: mode === "paste" ? null : value.savedTitle,
    });
  };

  const handleSelectFile = async (file: File) => {
    setUploading(true);
    setUploadedFileName(file.name);
    const created = await uploadPdf({
      file,
      roleTitle: value.roleTitle,
      company: value.company,
    });
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

  const handlePickSaved = (item: {
    id: string;
    title: string;
    company: string | null;
    roleTitle: string | null;
  }) => {
    onChange({
      ...value,
      mode: "saved",
      savedId: item.id,
      savedTitle: item.title,
      // Copied onto the config so it reaches `launch_meta` and, through it, the
      // interviewer's prompt. Picking a saved JD is the common path, and
      // without this the company would only ever be known for a JD created in
      // the same sitting.
      company: item.company ?? "",
      roleTitle: item.roleTitle ?? value.roleTitle,
      rawText: "",
    });
  };

  const handleRemoveSaved = async (id: string) => {
    const ok = await remove(id);
    if (ok && value.savedId === id) {
      onChange({
        ...value,
        savedId: null,
        savedTitle: null,
      });
    }
  };

  return (
    // Its own Card, with the header acting as the on/off row. It used to be a
    // bordered strip inside a shared "Documents" card, which made an enabled
    // picker a box inside a box inside a card, and put it 16px from the CV
    // picker — the same 16px separating two fields one card above.
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
              onChange({
                ...value,
                enabled: checked,
              })
            }
          />
        </CardAction>
      </CardHeader>

      {value.enabled && (
        <CardContent className="space-y-6">
          {/* Only shown when a new JD is being created. Picking one from the
              library means these are already set on the record, and offering
              editable copies here would imply this screen could change them —
              it cannot, and the library page is where that lives. */}
          {value.mode !== "saved" && (
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
                    onChange({
                      ...value,
                      roleTitle: event.target.value,
                    })
                  }
                />
              </Field>
            </div>
          )}

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
                  onChange({
                    ...value,
                    rawText: event.target.value,
                  })
                }
                className="min-h-40 resize-y"
              />
            </Field>
          )}

          {value.mode === "paste" && (
            <TidyJobDescription
              rawText={value.rawText}
              onApply={(result) =>
                onChange({
                  ...value,
                  rawText: result.cleanedText,
                  // Only filled in, never overwritten: whatever the user typed
                  // themselves beats what was inferred from the page.
                  company: value.company || (result.company ?? ""),
                  roleTitle: value.roleTitle || (result.roleTitle ?? ""),
                })
              }
            />
          )}

          {value.mode === "upload" && (
            <div className="rounded-xl border border-dashed border-border bg-muted/50 p-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) {
                    void handleSelectFile(file);
                  }
                }}
              />

              {value.savedId ? (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-white p-3">
                  {/* The upload row replaces the drop zone the instant the parse
                      lands, which read as a glitch; the tick now arrives on its
                      own so the success is legible as an event. */}
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 animate-in zoom-in-50 duration-300 ease-soft" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {value.savedTitle ?? "Uploaded PDF"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Embedded and ready to use
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Replace
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Upload className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-medium text-gray-800">
                    Upload a PDF job description
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Text is extracted and embedded automatically. Image-only
                    PDFs are not supported in this version.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploading
                      ? `Uploading${uploadedFileName ? ` ${uploadedFileName}` : ""}...`
                      : "Choose PDF"}
                  </Button>
                </div>
              )}
            </div>
          )}

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
                    No saved job descriptions yet
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
                          onClick={() => handlePickSaved(item)}
                          className="flex-1 text-left"
                        >
                          <p className="text-sm font-medium text-foreground">
                            {item.title}
                          </p>
                          {/* Company first, matching the library page — it is
                              what distinguishes two postings for one role.
                              Joined from present parts so a missing one does
                              not leave a stranded separator. */}
                          <p className="text-xs text-muted-foreground">
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
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveSaved(item.id)}
                          aria-label="Delete job description"
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
