"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TagEditor } from "@/components/sessions/tag-editor";

export interface TagsTarget {
  id: string;
  title: string;
  tags: string[];
}

/** Edit one session's tags from the sessions list. */
export function TagsDialog({
  target,
  suggestions,
  onOpenChange,
  onChange,
}: {
  target: TagsTarget | null;
  suggestions: string[];
  onOpenChange: (open: boolean) => void;
  onChange: (id: string, tags: string[]) => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tags</DialogTitle>
          <DialogDescription className="truncate">{target?.title}</DialogDescription>
        </DialogHeader>
        {target && (
          <TagEditor
            sessionId={target.id}
            tags={target.tags}
            suggestions={suggestions}
            onChange={(tags) => onChange(target.id, tags)}
            className="py-2"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
