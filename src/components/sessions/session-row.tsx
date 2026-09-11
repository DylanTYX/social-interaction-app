"use client";

import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
  Folder,
  MessageSquare,
  Mic,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Tag,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import type { InterviewSessionSummary } from "@/hooks/use-interview-history";
import { formatRelativeDate } from "@/lib/format";
import { ROW_ENTER, ROW_EXIT, staggerDelay } from "@/lib/motion";
import type { SessionFolder } from "@/lib/session-actions";
import { displayTitle } from "@/lib/session-organisation";
import { cn } from "@/lib/utils";

export const STATUS_TONE: Record<InterviewSessionSummary["status"], string> = {
  in_progress: "border-warning-border bg-warning-subtle text-warning-emphasis",
  completed: "border-success-border bg-success-subtle text-success-emphasis",
  abandoned: "border-slate-200 bg-slate-50 text-slate-600",
};

export const STATUS_LABEL: Record<InterviewSessionSummary["status"], string> = {
  in_progress: "In progress",
  completed: "Completed",
  abandoned: "Abandoned",
};

/** Tags shown on a row before the rest collapse into "+N". */
const VISIBLE_TAGS = 4;

export function SessionRow({
  session,
  index,
  exiting,
  selected,
  folders,
  onToggleSelect,
  onRename,
  onEditTags,
  onTogglePin,
  onMove,
  onToggleArchive,
  onDelete,
}: {
  session: InterviewSessionSummary;
  index: number;
  exiting: boolean;
  selected: boolean;
  folders: SessionFolder[];
  onToggleSelect: () => void;
  onRename: () => void;
  onEditTags: () => void;
  onTogglePin: () => void;
  onMove: (folderId: string | null) => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  const ModeIcon = session.practiceMode === "voice" ? Mic : MessageSquare;
  const title = displayTitle(session);
  const tags = session.tags ?? [];
  const folder = folders.find((entry) => entry.id === session.folderId) ?? null;
  const archived = Boolean(session.archivedAt);

  return (
    // The row is a Link, so the checkbox and the menu cannot live inside it —
    // controls nested in an anchor are invalid and the anchor swallows the
    // click. The wrapper positions them over it.
    <div
      className={cn("group relative", exiting ? ROW_EXIT : ROW_ENTER)}
      style={exiting ? undefined : staggerDelay(index)}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        aria-label={`Select ${title}`}
        className={cn(
          "absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 cursor-pointer accent-primary transition-opacity",
          selected ? "opacity-100" : "opacity-40 group-hover:opacity-100 focus-visible:opacity-100",
        )}
      />

      <Link
        href={
          session.status === "in_progress"
            ? session.practiceMode === "voice"
              ? `/simulate/voice?session=${session.id}`
              : `/simulate/chat?session=${session.id}`
            : `/simulate/report/${session.id}`
        }
        className={cn(
          "block rounded-xl border p-4 pl-12 pr-14 transition-colors duration-150 hover:bg-accent",
          selected ? "border-primary-border bg-primary-subtle/40" : "border-border",
          archived && "opacity-75",
        )}
      >
        <div className="flex items-center gap-4">
          <InitialsAvatar name={session.personaName} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {session.pinned && (
                <Pin className="h-3.5 w-3.5 shrink-0 fill-current text-primary" aria-label="Pinned" />
              )}
              <p className="min-w-0 font-medium text-slate-900 [overflow-wrap:anywhere]">{title}</p>
              <Badge variant="outline" className={STATUS_TONE[session.status]}>
                {STATUS_LABEL[session.status]}
              </Badge>
              {archived && (
                <Badge variant="outline" className="gap-1 border-slate-300 text-slate-600">
                  <Archive className="h-3 w-3" /> Archived
                </Badge>
              )}
              {folder && (
                <Badge variant="outline" className="gap-1 border-sky-200 bg-sky-50 text-sky-700">
                  <Folder className="h-3 w-3" /> {folder.name}
                </Badge>
              )}
            </div>

            {tags.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {tags.slice(0, VISIBLE_TAGS).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-xs text-purple-700"
                  >
                    {tag}
                  </span>
                ))}
                {tags.length > VISIBLE_TAGS && (
                  <span className="px-1 text-xs text-slate-500">+{tags.length - VISIBLE_TAGS}</span>
                )}
              </div>
            )}

            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              <span>{session.personaName}</span>
              <span>·</span>
              <span>{formatRelativeDate(session.createdAt)}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <ModeIcon className="h-3 w-3" />
                {session.practiceMode === "voice" ? "Voice" : "Text"}
              </span>
            </p>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-lg font-bold text-primary">
              {session.averageScore === null ? "—" : `${session.averageScore}%`}
            </div>
            <p className="text-xs text-muted-foreground">score</p>
          </div>
        </div>
      </Link>

      <div className="absolute right-3 top-1/2 -translate-y-1/2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
              aria-label={`Actions for ${title}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onRename}>
              <Pencil className="h-4 w-4" /> Rename
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onEditTags}>
              <Tag className="h-4 w-4" /> Edit tags
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onTogglePin}>
              {session.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              {session.pinned ? "Unpin" : "Pin to top"}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Folder className="h-4 w-4" /> Move to folder
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {folders.map((entry) => (
                  <DropdownMenuItem
                    key={entry.id}
                    disabled={entry.id === session.folderId}
                    onSelect={() => onMove(entry.id)}
                  >
                    {entry.name}
                  </DropdownMenuItem>
                ))}
                {folders.length > 0 && <DropdownMenuSeparator />}
                <DropdownMenuItem disabled={!session.folderId} onSelect={() => onMove(null)}>
                  No folder
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onSelect={onToggleArchive}>
              {archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              {archived ? "Unarchive" : "Archive"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 className="h-4 w-4" /> Delete session
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
