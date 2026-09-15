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
 *
 * It takes the place of the list's column headings while anything is ticked,
 * so the actions appear where the eye already is and the rows below do not
 * move. It used to be a separate tinted bar that pushed the whole list down by
 * its own height the moment the first box was ticked.
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
      <div className="flex min-h-11 flex-wrap items-center gap-2 py-1.5 pr-3 pl-12">
        <span className="text-sm font-medium text-primary-emphasis">
          {count} selected
        </span>
        {count === 1 && (
          <span className="hidden text-sm text-slate-500 sm:inline">
            Tick one more to compare
          </span>
        )}

        {onCompare && (
          <Button size="sm" onClick={onCompare} disabled={busy}>
            <GitCompareArrows />
            Compare
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={() => setTagging(true)}
          disabled={busy}
        >
          <Tag />
          Add tag
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={busy}>
              <Pin />
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
          onClick={() => onArchive(!showingArchived)}
          disabled={busy}
        >
          {showingArchived ? <ArchiveRestore /> : <Archive />}
          {showingArchived ? "Unarchive" : "Archive"}
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={busy}
        >
          <Trash2 />
          Delete
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          onClick={onClear}
          aria-label="Clear selection"
        >
          <X />
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
              <DialogTitle>
                Add a tag to {count} session{count === 1 ? "" : "s"}
              </DialogTitle>
              <DialogDescription>
                Sessions that already have it are left as they are.
              </DialogDescription>
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
                    className="inline-flex h-6 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-700 hover:bg-slate-100"
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
