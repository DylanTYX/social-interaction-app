"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FileUser, Trash2, Upload, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyStateCard } from "@/components/dashboard/empty-state-card";
import { useResumes } from "@/hooks/use-resumes";

function formatDate(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  return new Date(ts).toLocaleString();
}

export default function ResumesPage() {
  const { items, status, error, uploadText, uploadPdf, remove } = useResumes();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [title, setTitle] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [items],
  );

  const handlePasteSubmit = async () => {
    setFormError(null);
    if (pastedText.trim().length < 80) {
      setFormError("Paste at least 80 characters of resume text.");
      return;
    }
    setSubmitting(true);
    const created = await uploadText({
      rawText: pastedText,
      title: title.trim() || null,
    });
    setSubmitting(false);
    if (created) {
      setPastedText("");
      setTitle("");
    }
  };

  const handleUploadFile = async (file: File) => {
    setFormError(null);
    setSubmitting(true);
    const created = await uploadPdf({ file, title: title.trim() || null });
    setSubmitting(false);
    if (created) {
      setTitle("");
    }
  };

  return (
    <div className="p-8 space-y-8 bg-linear-to-br from-gray-50 via-white to-gray-50/50">
      <PageHeader
        eyebrow="Library"
        title="Resumes"
        description="Upload or paste your resume so the interviewer can ask targeted questions about your real experience and pressure-test the claims on it."
        icon={<FileUser className="h-6 w-6" />}
        iconColor="purple"
        actions={
          <Link href="/simulate/setup">
            <Button>
              <Sparkles className="mr-2 h-4 w-4" />
              Start an interview
            </Button>
          </Link>
        }
      />

      <Card className="border border-gray-200/80 shadow-soft bg-white">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileUser className="h-4 w-4 text-purple-600" />
            Add a resume
          </CardTitle>
          <CardDescription>
            Stored as plain text and sent to the interviewer so questions can
            reference your background. Don&apos;t include anything you wouldn&apos;t
            want in a prompt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("paste")}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                mode === "paste"
                  ? "border-purple-500 bg-purple-50 text-purple-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Paste text
            </button>
            <button
              type="button"
              onClick={() => setMode("upload")}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                mode === "upload"
                  ? "border-purple-500 bg-purple-50 text-purple-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Upload PDF
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="resume-title">Label (optional)</Label>
            <Input
              id="resume-title"
              placeholder="e.g. Jane Doe — 2026"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          {mode === "paste" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="paste-text">Resume text</Label>
                <span className="text-xs text-gray-500">
                  {pastedText.trim().length} chars
                </span>
              </div>
              <Textarea
                id="paste-text"
                placeholder="Paste your experience, skills, education, and projects..."
                value={pastedText}
                onChange={(event) => setPastedText(event.target.value)}
                className="min-h-40 resize-y"
              />
              <Button
                onClick={() => void handlePasteSubmit()}
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Save resume"}
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-purple-200 bg-purple-50/40 p-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) {
                    void handleUploadFile(file);
                  }
                }}
              />
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-600">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-gray-800">
                  Upload a PDF resume
                </p>
                <p className="text-xs text-gray-500">
                  Image-only PDFs are not supported in this version.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={submitting}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {submitting ? "Uploading..." : "Choose PDF"}
                </Button>
              </div>
            </div>
          )}

          {(formError || error) && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError ?? error}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border border-gray-200/80 shadow-soft bg-white">
        <CardHeader>
          <CardTitle className="text-base">Saved resumes</CardTitle>
          <CardDescription>
            Attach any of these inside the interview setup wizard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {status === "loading" && sortedItems.length === 0 ? (
            <div className="space-y-2">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-16 rounded-xl bg-gray-100 animate-pulse"
                />
              ))}
            </div>
          ) : sortedItems.length === 0 ? (
            <EmptyStateCard
              icon={<FileUser className="h-6 w-6" />}
              title="Add your resume to personalize the interview"
              description="Paste it or upload a PDF once — the interviewer will ask about your real projects and experience."
              primaryAction={{
                label: "Start an interview with your resume",
                href: "/simulate/setup",
              }}
            />
          ) : (
            sortedItems.map((item) => (
              <div
                key={item.id}
                className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-all duration-150 hover:border-purple-200 hover:shadow-soft"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100 text-purple-600 shrink-0">
                  <FileUser className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {formatDate(item.createdAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void remove(item.id)}
                  aria-label="Delete resume"
                >
                  <Trash2 className="h-4 w-4 text-gray-500" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
