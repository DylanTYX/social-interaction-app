"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileText, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useJobDescriptions } from "@/hooks/use-job-descriptions";
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
      onChange({
        ...value,
        savedId: null,
        savedTitle: null,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-blue-600" />
            <Label htmlFor="use-jd" className="text-sm font-medium">
              Job description
            </Label>
          </div>
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
        </div>

        {value.enabled && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="role-title">Applied role title</Label>
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
            </div>

            <div className="flex flex-wrap gap-2">
              {TAB_OPTIONS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMode(tab.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    value.mode === tab.id
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {value.mode === "paste" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="job-description-text">
                    Paste job description
                  </Label>
                  <span className="text-xs text-gray-500">
                    {value.rawText.trim().length} chars
                  </span>
                </div>
                <Textarea
                  id="job-description-text"
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
                {value.rawText.trim().length > 0 &&
                  value.rawText.trim().length < 80 && (
                    <p className="text-xs text-amber-600">
                      Paste at least 80 characters to enable JD context.
                    </p>
                  )}
              </div>
            )}

            {value.mode === "upload" && (
              <div className="space-y-3 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-4">
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
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {value.savedTitle ?? "Uploaded PDF"}
                      </p>
                      <p className="text-xs text-gray-500">
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
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                      <Upload className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium text-gray-800">
                      Upload a PDF job description
                    </p>
                    <p className="text-xs text-gray-500">
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
                      <div
                        key={index}
                        className="h-16 rounded-lg bg-gray-100 animate-pulse"
                      />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-center">
                    <p className="text-sm font-medium text-gray-800">
                      No saved job descriptions yet
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
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
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 bg-white hover:bg-gray-50"
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => handlePickSaved(item.id, item.title)}
                            className="flex-1 text-left"
                          >
                            <p className="text-sm font-medium text-gray-900">
                              {item.title}
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.roleTitle ?? "No role title"} ·{" "}
                              {new Date(item.createdAt).toLocaleDateString()}
                            </p>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveSaved(item.id)}
                            aria-label="Delete job description"
                          >
                            <Trash2 className="h-4 w-4 text-gray-500" />
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
