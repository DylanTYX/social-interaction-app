"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Dice5,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Sparkles,
  Users,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyStateCard } from "@/components/dashboard/empty-state-card";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { LibraryToolbar } from "@/components/dashboard/library-toolbar";
import { PersonaGridSkeleton } from "@/components/dashboard/page-skeletons";
import { PersonaCard } from "@/components/persona/persona-card";
import { PersonaConfigEditor } from "@/components/persona/persona-config-editor";
import { usePersonaLibrary } from "@/hooks/use-persona-library";
import {
  createBlankPersonaConfig,
  generateRandomPersonaConfig,
  personaIdentityComplete,
  sortPersonaLibrary,
  type PersonaLibraryEntry,
} from "@/lib/persona-library";
import {
  QUESTIONING_STYLE_META,
  type PersonaConfig,
} from "@/lib/persona-engine";
import { cn } from "@/lib/utils";
import { CONTENT_ENTER, ROW_ENTER, ROW_EXIT, staggerDelay } from "@/lib/motion";

/**
 * The persona library.
 *
 * Laid out like its siblings, job descriptions and resumes: the page header
 * carries the one workflow CTA ("Start an interview"), the row above the list
 * finds and adds, and each card's menu edits, duplicates or deletes. The
 * header used to hold three management buttons and the list had no row at
 * all, so this was the one library page with its own way of doing things.
 * The card and the editor are the same components the setup wizard renders.
 */
export default function PersonasPage() {
  const {
    library,
    status,
    error,
    refresh,
    createEntry,
    deleteEntry,
    duplicateEntry,
    resetLibrary,
    updateEntry,
  } = usePersonaLibrary();

  const [query, setQuery] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  /** The card being animated out of the grid. */
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"random" | "reset" | null>(null);
  /**
   * One dialog, two modes. "New" opens it on a blank config and saves through
   * `createEntry`; "Edit" opens it on a card's config and saves through
   * `updateEntry`. One state so the dialog cannot be open in both modes at
   * once, and closed is simply `null`.
   */
  const [editor, setEditor] = useState<
    { mode: "create" } | { mode: "edit"; entry: PersonaLibraryEntry } | null
  >(null);
  const [editDraft, setEditDraft] = useState<PersonaConfig | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const sortedLibrary = useMemo(() => sortPersonaLibrary(library), [library]);

  /**
   * Client-side, because the library is capped well below the point where a
   * round trip would earn its latency, and because "search" here means
   * "which of these dozen is the bar raiser" — name, style, seniority and
   * industry are what you would type.
   */
  const visibleLibrary = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sortedLibrary;
    return sortedLibrary.filter((entry) => {
      const { config } = entry;
      const style =
        QUESTIONING_STYLE_META[config.questioningStyle ?? "conversational"]
          .label;
      return [
        config.name,
        config.seniority,
        config.industry,
        config.nationality,
        style,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [query, sortedLibrary]);

  const handleRandom = async () => {
    setBusy("random");
    try {
      const created = await createEntry(generateRandomPersonaConfig());
      if (created) {
        toast.success("Persona added.");
      } else {
        toast.error(error ?? "Could not add persona.");
      }
    } finally {
      setBusy(null);
    }
  };

  const handleReset = async () => {
    setBusy("reset");
    try {
      await resetLibrary();
      setConfirmReset(false);
      toast.success("Preset personas restored.");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (id: string) => {
    // Marked as leaving before the request goes out, so the grid responds the
    // moment the user confirms rather than after a round trip.
    setExitingId(id);
    const deleted = await deleteEntry(id);
    if (!deleted) {
      setExitingId(null);
      toast.error(error ?? "Could not delete persona.");
    }
  };

  const openEdit = (entry: PersonaLibraryEntry) => {
    setEditor({ mode: "edit", entry });
    setEditDraft({ ...entry.config });
  };

  const openCreate = () => {
    setEditor({ mode: "create" });
    setEditDraft(createBlankPersonaConfig());
  };

  const closeEditor = () => {
    setEditor(null);
    setEditDraft(null);
  };

  /**
   * Mirrors the server's own rule: `parsePersonaConfig` returns null without
   * the four identity fields and the API rejects the request. Refusing here
   * is what turns a 400 into a disabled button.
   */
  const canSave = editDraft !== null && personaIdentityComplete(editDraft);

  const handleSaveEdit = async () => {
    if (!editor || !editDraft || !canSave) return;
    setSavingEdit(true);
    const saved =
      editor.mode === "create"
        ? await createEntry(editDraft)
        : await updateEntry(editor.entry.id, editDraft);
    setSavingEdit(false);
    if (saved) {
      toast.success(
        editor.mode === "create" ? "Persona created." : "Persona updated.",
      );
      closeEditor();
    } else {
      toast.error(error ?? "Could not save persona.");
    }
  };

  const handleDuplicate = async (entry: PersonaLibraryEntry) => {
    setDuplicatingId(entry.id);
    try {
      const copy = await duplicateEntry(entry);
      if (copy) {
        toast.success(`Duplicated as "${copy.config.name}".`);
      } else {
        toast.error(error ?? "Could not duplicate persona.");
      }
    } finally {
      setDuplicatingId(null);
    }
  };

  const isLoading = status === "loading" && library.length === 0;
  const hasQuery = query.trim().length > 0;

  return (
    <div className="p-8 space-y-8">
      <PageHeader
        eyebrow="Library"
        title="Personas"
        description="Tune the interviewer's culture, seniority, and style. Build them, edit them, save your favorites — your library is reused across all interviews."
        icon={<Users className="h-6 w-6" />}
        iconColor="purple"
        actions={
          <Button asChild>
            <Link href="/simulate/setup">
              <Sparkles className="mr-2 h-4 w-4" />
              Start an interview
            </Link>
          </Button>
        }
      />

      {(sortedLibrary.length > 0 || hasQuery) && (
        <LibraryToolbar
          search={{
            value: query,
            onChange: setQuery,
            placeholder: "Search name, seniority, industry, or style...",
            ariaLabel: "Search personas",
          }}
          actions={
            <>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                New persona
              </Button>
              <Button
                variant="outline"
                onClick={() => void handleRandom()}
                disabled={busy === "random"}
              >
                <Dice5 className="mr-2 h-4 w-4" />
                {busy === "random" ? "Adding..." : "Random persona"}
              </Button>
              {/* Rare and library-wide, so it earns a menu rather than a
                  button that sits beside "New" forever. */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="More library actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={busy === "reset"}
                    onSelect={() => setConfirmReset(true)}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restore presets
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />
      )}

      {isLoading ? (
        <PersonaGridSkeleton count={6} />
      ) : status === "error" ? (
        <ErrorStateCard
          title="Couldn't load your personas"
          description={error ?? "Something went wrong."}
          onRetry={() => void refresh()}
        />
      ) : sortedLibrary.length === 0 ? (
        <EmptyStateCard
          icon={<Users className="h-6 w-6" />}
          title="Build your interviewer roster"
          description="Create an interviewer from scratch, or spin up a random one in a click and edit from there."
          primaryAction={{ label: "Create a persona", onClick: openCreate }}
          secondaryAction={{
            label: "Generate random persona",
            onClick: () => void handleRandom(),
          }}
        />
      ) : visibleLibrary.length === 0 ? (
        <EmptyStateCard
          icon={<Users className="h-6 w-6" />}
          title="No personas match that search"
          description="Try a name, a seniority, an industry, or a questioning style."
          primaryAction={{ label: "Clear search", onClick: () => setQuery("") }}
        />
      ) : (
        <div
          className={cn(
            "grid md:grid-cols-2 lg:grid-cols-3 gap-6",
            CONTENT_ENTER,
          )}
        >
          {visibleLibrary.map((entry, index) => (
            <PersonaCard
              key={entry.id}
              entry={entry}
              onSelect={() => openEdit(entry)}
              className={exitingId === entry.id ? ROW_EXIT : ROW_ENTER}
              style={exitingId === entry.id ? undefined : staggerDelay(index)}
              menu={
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground opacity-60 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`Actions for ${entry.config.name}`}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  {/* Stopped on the content, not per item: the card is a
                      button that opens the editor, and React routes the
                      portalled menu's events through the component tree. */}
                  <DropdownMenuContent
                    align="end"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <DropdownMenuItem onSelect={() => openEdit(entry)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={duplicatingId === entry.id}
                      onSelect={() => void handleDuplicate(entry)}
                    >
                      {duplicatingId === entry.id
                        ? "Duplicating..."
                        : "Duplicate"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setPendingDelete(entry.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              }
            />
          ))}
        </div>
      )}

      <Dialog
        open={editor !== null}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {editor?.mode === "create" ? "New persona" : "Edit persona"}
            </DialogTitle>
            <DialogDescription>
              {editor?.mode === "create"
                ? "Saved to your library and available in every interview setup."
                : "Changes are saved to your library and used in future interviews."}
            </DialogDescription>
          </DialogHeader>
          {editDraft && (
            <PersonaConfigEditor
              value={editDraft}
              onChange={(patch) =>
                setEditDraft((current) =>
                  current ? { ...current, ...patch } : current,
                )
              }
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeEditor}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleSaveEdit()}
              disabled={savingEdit || !canSave}
            >
              {savingEdit
                ? "Saving..."
                : editor?.mode === "create"
                  ? "Create persona"
                  : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore preset personas?</DialogTitle>
            <DialogDescription>
              This re-seeds the built-in personas. Your custom personas are not
              touched.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmReset(false)}
              disabled={busy === "reset"}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleReset()}
              disabled={busy === "reset"}
            >
              {busy === "reset" ? "Restoring..." : "Restore presets"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDeleteDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this persona?"
        description="Interviews already run with this persona keep their saved copy of it."
        onConfirm={async () => {
          if (pendingDelete) await handleDelete(pendingDelete);
          setPendingDelete(null);
        }}
      />
    </div>
  );
}
