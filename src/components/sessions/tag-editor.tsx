"use client";

import { useId, useRef, useState } from "react";
import { Plus, Tag, X } from "lucide-react";
import { toast } from "sonner";

import { MAX_SESSION_TAG_CHARS, MAX_SESSION_TAGS } from "@/lib/api/input-limits";
import { patchSessionRequest } from "@/lib/session-actions";
import { addTag, normalizeTag, removeTag } from "@/lib/session-organisation";
import { cn } from "@/lib/utils";

/**
 * A session's tags as chips, with remove and add in place.
 *
 * Tags are normalised with the same rules the API applies, so what the chip
 * shows is what is stored. Suggestions come from tags already in use, which is
 * what keeps "Acme" from becoming "acme", "ACME" and "Acme Corp" by accident.
 */
export function TagEditor({
  sessionId,
  tags,
  suggestions = [],
  onChange,
  className,
}: {
  sessionId: string;
  tags: string[];
  suggestions?: string[];
  onChange: (tags: string[]) => void;
  className?: string;
}) {
  const listId = useId();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const cancelledRef = useRef(false);

  const save = async (next: string[]) => {
    setSaving(true);
    try {
      const session = await patchSessionRequest(sessionId, { tags: next });
      onChange(session.tags);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update tags.");
    } finally {
      setSaving(false);
    }
  };

  const commit = async () => {
    if (cancelledRef.current) return;
    const tag = normalizeTag(draft);
    setDraft("");
    setAdding(false);
    if (!tag) return;
    const next = addTag(tags, tag);
    if (next.length === tags.length) return;
    if (next.length > MAX_SESSION_TAGS) {
      toast.error(`A session can have up to ${MAX_SESSION_TAGS} tags.`);
      return;
    }
    await save(next);
  };

  const unused = suggestions.filter(
    (suggestion) =>
      !tags.some((tag) => tag.toLocaleLowerCase() === suggestion.toLocaleLowerCase()),
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 py-0.5 pl-2 pr-1 text-xs font-medium text-purple-700"
        >
          <Tag className="h-3 w-3" aria-hidden />
          {tag}
          <button
            type="button"
            onClick={() => void save(removeTag(tags, tag))}
            disabled={saving}
            aria-label={`Remove tag ${tag}`}
            className="rounded-full p-0.5 hover:bg-purple-100 disabled:opacity-50 print:hidden"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}

      {adding ? (
        <form
          className="print:hidden"
          onSubmit={(event) => {
            event.preventDefault();
            void commit();
          }}
        >
          <input
            autoFocus
            list={listId}
            value={draft}
            maxLength={MAX_SESSION_TAG_CHARS}
            placeholder="Add a tag"
            aria-label="New tag"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={() => void commit()}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancelledRef.current = true;
                setDraft("");
                setAdding(false);
              }
            }}
            className="h-6 w-36 rounded-full border border-purple-300 bg-white px-2.5 text-xs text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-purple-300"
          />
          <datalist id={listId}>
            {unused.map((suggestion) => (
              <option key={suggestion} value={suggestion} />
            ))}
          </datalist>
        </form>
      ) : (
        tags.length < MAX_SESSION_TAGS && (
          <button
            type="button"
            onClick={() => {
              cancelledRef.current = false;
              setAdding(true);
            }}
            disabled={saving}
            className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 text-xs text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-700 print:hidden"
          >
            <Plus className="h-3 w-3" aria-hidden />
            {tags.length === 0 ? "Add tag" : "Tag"}
          </button>
        )
      )}
    </div>
  );
}
