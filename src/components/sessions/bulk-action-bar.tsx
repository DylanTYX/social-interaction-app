"use client";

import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  GitCompareArrows,
  Pin,
  PinOff,
  Tag,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { MAX_SESSION_TAG_CHARS } from "@/lib/api/input-limits";
import { normalizeTag } from "@/lib/session-organisation";

/**
 * What to do with the sessions ticked on the list. Compare needs exactly two.
 */
export function BulkActionBar({
  count,
  tagSuggestions,
  showingArchived,
  busy,
  onClear,
  onArchive,
  onPin,
  onAddTag,
  onDelete,
  onCompare,
}: {
  count: number;
  tagSuggestions: string[];
  showingArchived: boolean;
  busy: boolean;
  onClear: () => void;
  onArchive: (archive: boolean) => void;
  onPin: (pin: boolean) => void;
  onAddTag: (tag: string) => void;
  onDelete: () => void;
  /** Present only when exactly two sessions are selected. */
  onCompare: (() => void) | null;
}) {
  const [tagging, setTagging] = useState(false);
  const [tagDraft, setTagDraft] = useState("");

  if (count === 0) return null;

  return (
    <>
      <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-primary-border bg-primary-subtle/95 px-3 py-2 shadow-soft-md backdrop-blur">
        <span className="px-1 text-sm font-medium text-primary-emphasis">
          {count} selected
        </span>

        {onCompare && (
          <Button size="sm" className="gap-1.5" onClick={onCompare} disabled={busy}>
            <GitCompareArrows className="h-4 w-4" />
            Compare
          </Button>
        )}

        <Button size="sm" variant="outline" className="gap-1.5 bg-white" onClick={() => setTagging(true)} disabled={busy}>
          <Tag className="h-4 w-4" />
          Add tag
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5 bg-white" disabled={busy}>
              <Pin className="h-4 w-4" />
              Pin
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={() => onPin(true)}>
              <Pin className="h-4 w-4" /> Pin to top
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onPin(false)}>
              <PinOff className="h-4 w-4" /> Unpin
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 bg-white"
          onClick={() => onArchive(!showingArchived)}
          disabled={busy}
        >
          {showingArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          {showingArchived ? "Unarchive" : "Archive"}
        </Button>

        <Button size="sm" variant="outline" className="gap-1.5 bg-white text-destructive hover:text-destructive" onClick={onDelete} disabled={busy}>
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>

        <Button size="sm" variant="ghost" className="ml-auto gap-1" onClick={onClear} aria-label="Clear selection">
          <X className="h-4 w-4" />
          Clear
        </Button>
      </div>

      <Dialog open={tagging} onOpenChange={setTagging}>
        <DialogContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const tag = normalizeTag(tagDraft);
              if (!tag) return;
              onAddTag(tag);
              setTagDraft("");
              setTagging(false);
            }}
          >
            <DialogHeader>
              <DialogTitle>Add a tag to {count} session{count === 1 ? "" : "s"}</DialogTitle>
              <DialogDescription>Sessions that already have it are left as they are.</DialogDescription>
            </DialogHeader>
            <Input
              autoFocus
              className="my-4"
              value={tagDraft}
              maxLength={MAX_SESSION_TAG_CHARS}
              placeholder="e.g. Acme, final round"
              aria-label="Tag"
              onChange={(event) => setTagDraft(event.target.value)}
            />
            {tagSuggestions.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                {tagSuggestions.slice(0, 10).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setTagDraft(suggestion)}
                    className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-0.5 text-xs text-purple-700 hover:bg-purple-100"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <DialogFooter>
              <Button type="submit" disabled={!normalizeTag(tagDraft)}>
                Add tag
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
