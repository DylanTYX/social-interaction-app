"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FileText, Trash2, Upload, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
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
import { JobDescriptionRowSkeleton } from "@/components/dashboard/page-skeletons";
import { useJobDescriptions } from "@/hooks/use-job-descriptions";
import { formatDateTime } from "@/lib/format";

export default function JobDescriptionsPage() {
  const { items, status, error, uploadText, uploadPdf, remove } =
    useJobDescriptions();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [roleTitle, setRoleTitle] = useState("");
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
      setFormError("Paste at least 80 characters of job description text.");
      return;
    }
    setSubmitting(true);
    const created = await uploadText({
      rawText: pastedText,
      roleTitle: roleTitle.trim() || null,
    });
    setSubmitting(false);
    if (created) {
      setPastedText("");
      setRoleTitle("");
    }
  };

  const handleUploadFile = async (file: File) => {
    setFormError(null);
    setSubmitting(true);
    const created = await uploadPdf({
      file,
      roleTitle: roleTitle.trim() || null,
    });
    setSubmitting(false);
    if (created) {
      setRoleTitle("");
    }
  };

  return (
    <div className="p-8 space-y-8 bg-linear-to-br from-gray-50 via-white to-gray-50/50">
      <PageHeader
        eyebrow="Library"
        title="Job descriptions"
        description="Upload or paste job descriptions and reuse them across interviews. We embed and chunk them once so the interviewer pulls only the most relevant excerpts on each turn."
        icon={<FileText className="h-6 w-6" />}
        iconColor="green"
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
            <FileText className="h-4 w-4 text-indigo-600" />
            Add a job description
          </CardTitle>
          <CardDescription>
            We embed and chunk it once so the interviewer can pull only the
            relevant excerpts on each turn.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("paste")}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                mode === "paste"
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
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
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              Upload PDF
            </button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role-title">Applied role title (optional)</Label>
            <Input
              id="role-title"
              placeholder="e.g. Senior Product Manager"
              value={roleTitle}
              onChange={(event) => setRoleTitle(event.target.value)}
            />
          </div>

          {mode === "paste" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="paste-text">Job description text</Label>
                <span className="text-xs text-gray-500">
                  {pastedText.trim().length} chars
                </span>
              </div>
              <Textarea
                id="paste-text"
                placeholder="Paste responsibilities, requirements, and context..."
                value={pastedText}
                onChange={(event) => setPastedText(event.target.value)}
                className="min-h-40 resize-y"
              />
              <Button
                onClick={() => void handlePasteSubmit()}
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Save job description"}
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/40 p-4">
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
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <Upload className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-gray-800">
                  Upload a PDF job description
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
          <CardTitle className="text-base">Saved job descriptions</CardTitle>
          <CardDescription>
            Pick any of these inside the interview setup wizard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {status === "loading" && sortedItems.length === 0 ? (
            <div className="space-y-2">
              <JobDescriptionRowSkeleton />
              <JobDescriptionRowSkeleton />
              <JobDescriptionRowSkeleton />
            </div>
          ) : sortedItems.length === 0 ? (
            <EmptyStateCard
              icon={<FileText className="h-6 w-6" />}
              title="Add a job description to ground the interview"
              description="Paste the posting or upload a PDF once — we'll pull the most relevant bullets into each question."
              primaryAction={{
                label: "Start an interview with a JD",
                href: "/simulate/setup",
              }}
            />
          ) : (
            sortedItems.map((item) => (
              <div
                key={item.id}
                className="group flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 transition-all duration-150 hover:border-green-200 hover:shadow-soft"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100 text-green-600 shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {item.roleTitle ?? "No role title"} ·{" "}
                    {formatDateTime(item.createdAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setPendingDelete(item.id)}
                  aria-label="Delete job description"
                >
                  <Trash2 className="h-4 w-4 text-gray-500" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this job description?"
        description="This also deletes its embedded chunks, so interviews can no longer retrieve context from it. Existing transcripts are unaffected."
        onConfirm={async () => {
          if (pendingDelete) await remove(pendingDelete);
          setPendingDelete(null);
        }}
      />

    </div>
  );
}
