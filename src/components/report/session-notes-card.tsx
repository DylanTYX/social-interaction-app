"use client";

import { useState } from "react";
import { StickyNote } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MAX_SESSION_NOTES_CHARS } from "@/lib/api/input-limits";
import { patchSessionRequest } from "@/lib/session-actions";

/**
 * Private takeaways at the end of a report — what to do differently next time.
 *
 * Last on the page on purpose: it is written after reading the scores, the
 * transcript and the coaching, not in the middle of them. Stored as the
 * session's `notes`.
 *
 * Saved on request rather than on every keystroke: each save is a write to the
 * session, and a half-typed thought is not worth storing.
 */
export function SessionNotesCard({
  sessionId,
  notes,
  onSaved,
}: {
  sessionId: string;
  notes: string | null;
  onSaved: (notes: string | null) => void;
}) {
  const [draft, setDraft] = useState(notes ?? "");
  const [saving, setSaving] = useState(false);

  const unchanged = draft.trim() === (notes ?? "").trim();

  const save = async () => {
    setSaving(true);
    try {
      const session = await patchSessionRequest(sessionId, {
        notes: draft.trim() || null,
      });
      onSaved(session.notes);
      toast.success("Takeaways saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your takeaways.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-slate-200/80 bg-white print:break-inside-avoid">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <StickyNote className="h-4 w-4 text-slate-500" aria-hidden />
          Your takeaways
        </CardTitle>
        <CardDescription>
          What will you do differently next time? Only you can see this.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={draft}
          maxLength={MAX_SESSION_NOTES_CHARS}
          rows={4}
          placeholder="e.g. Lead with the result in the conflict story; slow down on the system design intro."
          onChange={(event) => setDraft(event.target.value)}
          className="print:hidden"
        />
        {notes && (
          <p className="hidden whitespace-pre-line text-sm text-slate-700 print:block">{notes}</p>
        )}
        <div className="flex items-center justify-between gap-3 print:hidden">
          <span className="text-xs tabular-nums text-slate-500">
            {draft.length.toLocaleString()} / {MAX_SESSION_NOTES_CHARS.toLocaleString()}
          </span>
          <Button size="sm" onClick={() => void save()} disabled={saving || unchanged}>
            {saving ? "Saving…" : unchanged && notes ? "Saved" : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
