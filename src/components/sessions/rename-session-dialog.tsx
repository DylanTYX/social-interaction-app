"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MAX_SESSION_TITLE_CHARS } from "@/lib/api/input-limits";
import { patchSessionRequest } from "@/lib/session-actions";

export interface RenameTarget {
  id: string;
  title: string | null;
  generatedTitle: string;
}

/**
 * Rename from the sessions list. A dialog rather than editing in place because
 * each row is a link: an input inside it would navigate on every click.
 */
export function RenameSessionDialog({
  target,
  onOpenChange,
  onRenamed,
}: {
  target: RenameTarget | null;
  onOpenChange: (open: boolean) => void;
  onRenamed: (id: string, title: string | null) => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        {target && (
          <RenameForm
            key={target.id}
            target={target}
            onDone={(title) => {
              onRenamed(target.id, title);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function RenameForm({
  target,
  onDone,
}: {
  target: RenameTarget;
  onDone: (title: string | null) => void;
}) {
  const [draft, setDraft] = useState(target.title ?? target.generatedTitle);
  const [saving, setSaving] = useState(false);

  const save = async (value: string | null) => {
    setSaving(true);
    try {
      const session = await patchSessionRequest(target.id, { title: value });
      onDone(session.title);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't rename this session.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const next = draft.trim();
        void save(!next || next === target.generatedTitle ? null : next);
      }}
    >
      <DialogHeader>
        <DialogTitle>Rename session</DialogTitle>
        <DialogDescription>
          Only changes how the session is listed. The interview itself is untouched.
        </DialogDescription>
      </DialogHeader>
      <Input
        autoFocus
        className="my-4"
        value={draft}
        maxLength={MAX_SESSION_TITLE_CHARS}
        aria-label="Session title"
        onChange={(event) => setDraft(event.target.value)}
      />
      <DialogFooter className="gap-2 sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          disabled={saving || target.title === null}
          onClick={() => void save(null)}
        >
          Use generated title
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
