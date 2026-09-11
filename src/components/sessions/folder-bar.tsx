"use client";

import { useState } from "react";
import { Folder, FolderPlus, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MAX_FOLDER_NAME_CHARS } from "@/lib/api/input-limits";
import type { SessionFolder } from "@/lib/session-actions";
import { cn } from "@/lib/utils";

/** "all", "none" (unfiled), or a folder id. */
export type FolderSelection = string;

const chip =
  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors";
const chipIdle = "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900";
const chipActive = "border-primary-border bg-primary-subtle text-primary-emphasis";

/**
 * Folders as a row of chips: pick one to filter, create, rename, delete.
 * Deleting is confirmed by the page, which knows how many sessions it holds.
 */
export function FolderBar({
  folders,
  active,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  folders: SessionFolder[];
  active: FolderSelection;
  onSelect: (value: FolderSelection) => void;
  onCreate: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onDelete: (folder: SessionFolder) => void;
}) {
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (action: () => Promise<void>) => {
    if (!draft.trim()) {
      setCreating(false);
      setRenamingId(null);
      return;
    }
    setBusy(true);
    try {
      await action();
      setCreating(false);
      setRenamingId(null);
      setDraft("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that folder.");
    } finally {
      setBusy(false);
    }
  };

  const nameInput = (onSubmit: () => void, label: string) => (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <input
        autoFocus
        value={draft}
        maxLength={MAX_FOLDER_NAME_CHARS}
        disabled={busy}
        aria-label={label}
        placeholder="Folder name"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={onSubmit}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            setDraft("");
            setCreating(false);
            setRenamingId(null);
          }
        }}
        className="h-8 w-40 rounded-full border border-primary-border bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      />
    </form>
  );

  return (
    <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Folders">
      <button type="button" className={cn(chip, active === "all" ? chipActive : chipIdle)} onClick={() => onSelect("all")}>
        All sessions
      </button>
      <button type="button" className={cn(chip, active === "none" ? chipActive : chipIdle)} onClick={() => onSelect("none")}>
        Unfiled
      </button>

      {folders.map((folder) =>
        renamingId === folder.id ? (
          <div key={folder.id}>
            {nameInput(() => void submit(() => onRename(folder.id, draft.trim())), `Rename ${folder.name}`)}
          </div>
        ) : (
          <div
            key={folder.id}
            className={cn(chip, "pr-1", active === folder.id ? chipActive : chipIdle)}
          >
            <button type="button" className="inline-flex items-center gap-1.5" onClick={() => onSelect(folder.id)}>
              <Folder className="h-3.5 w-3.5" aria-hidden />
              <span className="max-w-[12rem] truncate">{folder.name}</span>
              <span className="tabular-nums text-xs opacity-60">{folder.sessionCount}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="rounded-full p-1 opacity-60 hover:bg-black/5 hover:opacity-100"
                  aria-label={`Actions for folder ${folder.name}`}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem
                  onSelect={() => {
                    setDraft(folder.name);
                    setRenamingId(folder.id);
                  }}
                >
                  Rename folder
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => onDelete(folder)}>
                  Delete folder
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ),
      )}

      {creating ? (
        nameInput(() => void submit(() => onCreate(draft.trim())), "New folder name")
      ) : (
        <button
          type="button"
          className={cn(chip, "border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-800")}
          onClick={() => {
            setDraft("");
            setCreating(true);
          }}
        >
          <FolderPlus className="h-3.5 w-3.5" aria-hidden />
          New folder
        </button>
      )}
    </div>
  );
}
