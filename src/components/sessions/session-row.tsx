"use client";

import Link from "next/link";
import {
  Archive,
  ArchiveRestore,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import type { InterviewSessionSummary } from "@/hooks/use-interview-history";
import { formatRelativeDate } from "@/lib/format";
import { ROW_ENTER, ROW_EXIT, staggerDelay } from "@/lib/motion";
import { displayTitle } from "@/lib/session-organisation";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<InterviewSessionSummary["status"], string> = {
  in_progress: "In progress",
  completed: "Completed",
  abandoned: "Abandoned",
};

/**
 * The column template, shared with the list's heading row so the headings sit
 * over their columns. Below `md` the row keeps only the session and the score,
 * and the mode and date move into the line under the title.
 *
 * The paddings leave room for the checkbox on the left and the menu on the
 * right, which sit over the row rather than inside the link.
 */
export const SESSION_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 pr-14 pl-12 md:grid-cols-[minmax(0,1fr)_6rem_8rem_6.5rem]";

/** Tags shown on a row before the rest collapse into "+N". */
const VISIBLE_TAGS = 3;

/**
 * The score column. A number when there is one; otherwise the state that
 * explains why not.
 *
 * This used to be a green "Completed" badge on nearly every row beside the
 * score, which made the one row that needed attention, the unfinished one,
 * look like all the others. Completed is the normal state, so it says nothing;
 * only the exceptions get a badge.
 */
function ScoreCell({ session }: { session: InterviewSessionSummary }) {
  if (session.status === "in_progress") {
    return <Badge variant="warning">In progress</Badge>;
  }
  if (session.averageScore === null) {
    return session.status === "abandoned" ? (
      <Badge variant="outline">Abandoned</Badge>
    ) : (
      <span className="text-sm text-slate-400">—</span>
    );
  }
  return (
    <span className="inline-flex flex-col items-end">
      <span className="font-display text-lg leading-none font-bold tracking-tight text-navy tabular-nums">
        {session.averageScore}%
      </span>
      {session.status === "abandoned" && (
        <span className="mt-1 text-xs text-slate-500">Abandoned</span>
      )}
    </span>
  );
}

/**
 * One session in the list: a row in a table-like list inside one card, not a
 * card of its own. Fifty bordered cards stacked with gaps read as fifty
 * separate objects; hairline rows read as one list you can scan down a column.
 */
export function SessionRow({
  session,
  index,
  exiting,
  selected,
  onToggleSelect,
  onRename,
  onEditTags,
  onTogglePin,
  onToggleArchive,
  onDelete,
}: {
  session: InterviewSessionSummary;
  index: number;
  exiting: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onRename: () => void;
  onEditTags: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
}) {
  const voice = session.practiceMode === "voice";
  const ModeIcon = voice ? Mic : MessageSquare;
  const modeLabel = voice ? "Voice" : "Text";
  const title = displayTitle(session);
  const tags = session.tags ?? [];
  const archived = Boolean(session.archivedAt);
  const date = formatRelativeDate(session.createdAt);

  return (
    // The row is a Link, so the checkbox and the menu cannot live inside it —
    // controls nested in an anchor are invalid and the anchor swallows the
    // click. The wrapper positions them over it.
    <li
      className={cn("group relative", exiting ? ROW_EXIT : ROW_ENTER)}
      style={exiting ? undefined : staggerDelay(index)}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        aria-label={`Select ${title}`}
        className="absolute top-1/2 left-5 z-10 h-4 w-4 -translate-y-1/2 cursor-pointer accent-primary"
      />

      <Link
        href={
          session.status === "in_progress"
            ? voice
              ? `/simulate/voice?session=${session.id}`
              : `/simulate/chat?session=${session.id}`
            : `/simulate/report/${session.id}`
        }
        className={cn(
          SESSION_GRID,
          "py-3.5 transition-colors duration-150 group-last:rounded-b-xl",
          selected ? "bg-primary-subtle" : "hover:bg-slate-50",
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <InitialsAvatar name={session.personaName} size="sm" />
          <div className="min-w-0">
            <p className="flex min-w-0 items-center gap-1.5 font-medium text-slate-900">
              {session.pinned && (
                <Pin
                  className="h-3.5 w-3.5 shrink-0 fill-current text-primary"
                  aria-label="Pinned"
                />
              )}
              <span className="truncate" title={title}>
                {title}
              </span>
            </p>
            <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500">
              <span className="truncate">{session.personaName}</span>
              <span className="md:hidden" aria-hidden>
                ·
              </span>
              <span className="md:hidden">{date}</span>
              <span className="md:hidden" aria-hidden>
                ·
              </span>
              <span className="md:hidden">{modeLabel}</span>
              {tags.slice(0, VISIBLE_TAGS).map((tag) => (
                <span
                  key={tag}
                  className="inline-flex h-6 items-center rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-600"
                >
                  {tag}
                </span>
              ))}
              {tags.length > VISIBLE_TAGS && (
                <span className="text-xs text-slate-500">
                  +{tags.length - VISIBLE_TAGS}
                </span>
              )}
            </div>
          </div>
        </div>

        <span className="hidden items-center gap-1.5 text-sm text-slate-600 md:flex">
          <ModeIcon className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          {modeLabel}
        </span>
        <span className="hidden text-sm text-slate-600 md:block">{date}</span>
        <span className="flex justify-end">
          <ScoreCell session={session} />
        </span>
      </Link>

      <div className="absolute top-1/2 right-3 -translate-y-1/2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-500"
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
              {session.pinned ? (
                <PinOff className="h-4 w-4" />
              ) : (
                <Pin className="h-4 w-4" />
              )}
              {session.pinned ? "Unpin" : "Pin to top"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onToggleArchive}>
              {archived ? (
                <ArchiveRestore className="h-4 w-4" />
              ) : (
                <Archive className="h-4 w-4" />
              )}
              {archived ? "Unarchive" : "Archive"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 className="h-4 w-4" /> Delete session
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
