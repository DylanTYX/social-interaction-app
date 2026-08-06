"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileUser, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ChoiceChip } from "@/components/ui/choice-chip";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useResumes } from "@/hooks/use-resumes";
import type { ResumeSetupConfig, ResumeSetupMode } from "@/lib/interview-setup";

const TAB_OPTIONS: Array<{ id: ResumeSetupMode; label: string }> = [
  { id: "paste", label: "Paste text" },
  { id: "upload", label: "Upload PDF" },
  { id: "saved", label: "From library" },
];

interface ResumePickerProps {
  value: ResumeSetupConfig;
  onChange: (next: ResumeSetupConfig) => void;
}

export function ResumePicker({ value, onChange }: ResumePickerProps) {
  const { items, status, error, uploadPdf, remove } = useResumes();
  const fileInputRef = useRef<HTMLInputElement>(null);
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
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-white p-3">
          <div className="flex items-center gap-2">
            <FileUser className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Label htmlFor="use-resume" className="text-sm font-medium">
              CV
            </Label>
          </div>
          <Switch
            id="use-resume"
            checked={value.enabled}
            onCheckedChange={(checked) =>
              onChange({ ...value, enabled: checked })
            }
          />
        </div>

        {value.enabled && (
          <div className="space-y-3">
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

            {value.mode === "paste" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="resume-text">Paste resume</Label>
                  <span className="text-xs text-muted-foreground">
                    {value.rawText.trim().length} chars
                  </span>
                </div>
                <Textarea
                  id="resume-text"
                  placeholder="Paste your experience, skills, education, and projects here..."
                  value={value.rawText}
                  onChange={(event) =>
                    onChange({ ...value, rawText: event.target.value })
                  }
                  className="min-h-40 resize-y"
                />
                {value.rawText.trim().length > 0 &&
                  value.rawText.trim().length < 80 && (
                    <p className="text-xs text-destructive">
                      Paste at least 80 characters to enable resume context.
                    </p>
                  )}
              </div>
            )}

            {value.mode === "upload" && (
              <div className="space-y-3 rounded-xl border border-dashed border-border bg-muted/50 p-4">
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
                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {value.savedTitle ?? "Uploaded resume"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Ready to use
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
                      Upload a PDF resume
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Text is extracted automatically. Image-only PDFs are not
                      supported in this version.
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
                      <div
                        key={index}
                        className="h-16 rounded-lg bg-muted animate-pulse"
                      />
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
              <p className="text-xs text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
