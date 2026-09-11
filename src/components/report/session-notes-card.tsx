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
 * Private notes on a report — what to do differently next time.
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
      toast.success("Notes saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save your notes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="relative overflow-hidden border-amber-200/80 bg-amber-50/40">
      <div className="absolute inset-y-0 left-0 w-1 bg-amber-400" aria-hidden />
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <StickyNote className="h-4 w-4 text-amber-600" aria-hidden />
          Your notes
        </CardTitle>
        <CardDescription>
          Private to you. What would you do differently next time?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={draft}
          maxLength={MAX_SESSION_NOTES_CHARS}
          rows={4}
          placeholder="e.g. Lead with the result in the conflict story; slow down on the system design intro."
          onChange={(event) => setDraft(event.target.value)}
          className="bg-white print:hidden"
        />
        {notes && (
          <p className="hidden whitespace-pre-line text-sm text-slate-700 print:block">{notes}</p>
        )}
        <div className="flex items-center justify-between gap-3 print:hidden">
          <span className="text-xs tabular-nums text-slate-500">
            {draft.length.toLocaleString()} / {MAX_SESSION_NOTES_CHARS.toLocaleString()}
          </span>
          <Button size="sm" onClick={() => void save()} disabled={saving || unchanged}>
            {saving ? "Saving…" : unchanged && notes ? "Saved" : "Save notes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
