"use client";

import { useState } from "react";
import { Check, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { readJson } from "@/lib/api/fetch-json";

export interface TidyResult {
  cleanedText: string;
  roleTitle: string | null;
  company: string | null;
}

/**
 * Offers to strip page furniture out of a pasted job posting.
 *
 * Pasting from a careers page brings the nav, the cookie banner, the "about us"
 * marketing and the EEO statement along with the actual role, and all of it is
 * chunked and embedded identically. Retrieval then returns a fixed four chunks
 * per turn, so every boilerplate chunk that scores into the top four displaces
 * a real requirement — on every turn of every session using that JD.
 *
 * Three deliberate constraints:
 *
 *   - **Opt-in.** Cleaning on save would put a model between the user and their
 *     own document with no way to see what it took out.
 *   - **Shows the difference before it is accepted.** The panel states how much
 *     was removed and lets the original be restored in one click, because
 *     "trust me, that was all boilerplate" is not something a tool gets to say
 *     about a document someone is about to interview against.
 *   - **Never blocks.** Every failure path leaves the pasted text exactly as it
 *     was and says to save it as-is. Tidying is an improvement, not a step.
 */
export function TidyJobDescription({
  rawText,
  onApply,
}: {
  rawText: string;
  /** Applied only when the user accepts; also carries any extracted fields. */
  onApply: (result: TidyResult) => void;
}) {
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  /** The text as it was before tidying, kept so this is reversible. */
  const [previous, setPrevious] = useState<string | null>(null);

  const trimmedLength = rawText.trim().length;
  const canTidy = trimmedLength >= 400 && status !== "working";

  const handleTidy = async () => {
    setStatus("working");
    setError(null);
    try {
      const response = await fetch("/api/job-descriptions/clean", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      const result = await readJson<TidyResult>(response);
      setPrevious(rawText);
      onApply(result);
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setError(
        err instanceof Error
          ? err.message
          : "Could not tidy that up. Save it as-is.",
      );
    }
  };

  const handleUndo = () => {
    if (previous === null) return;
    onApply({ cleanedText: previous, roleTitle: null, company: null });
    setPrevious(null);
  };

  if (previous !== null) {
    const removed = previous.trim().length - trimmedLength;
    const percent = Math.round((removed / previous.trim().length) * 100);

    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2 animate-in fade-in-0 slide-in-from-top-1 duration-200 ease-soft">
        <Check className="h-4 w-4 shrink-0 text-emerald-600" />
        <p className="flex-1 text-xs text-emerald-900">
          {/* States the size of the change rather than asserting it was
              correct. The text is right there to read. */}
          {removed > 0
            ? `Removed ${removed.toLocaleString()} characters of page furniture — about ${percent}%. Read it over before saving.`
            : "Nothing worth removing — the text is unchanged."}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleUndo}
          className="h-7 gap-1.5 text-xs text-emerald-900 hover:bg-emerald-100"
        >
          <X className="h-3.5 w-3.5" />
          Undo
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleTidy()}
          disabled={!canTidy}
          className="gap-1.5"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {status === "working" ? "Tidying up..." : "Tidy this up"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {trimmedLength < 400
            ? "Paste the full posting to enable this."
            : "Strips navigation, cookie notices and boilerplate so the interviewer reads only the role."}
        </p>
      </div>

      {status === "error" && error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
