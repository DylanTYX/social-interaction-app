"use client";

import { useMemo, useState } from "react";
import {
  Briefcase,
  Dice5,
  Globe,
  RotateCcw,
  MoreHorizontal,
  Users,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/dashboard/page-header";
import { EmptyStateCard } from "@/components/dashboard/empty-state-card";
import { ErrorStateCard } from "@/components/dashboard/error-state-card";
import { PersonaGridSkeleton } from "@/components/dashboard/page-skeletons";
import { usePersonaLibrary } from "@/hooks/use-persona-library";
import {
  generateRandomPersonaConfig,
  type PersonaLibraryEntry,
} from "@/lib/persona-library";
import { PersonaConfigEditor } from "@/components/persona/persona-config-editor";
import type { PersonaConfig } from "@/lib/persona-engine";
import { cn } from "@/lib/utils";
import {
  CONTENT_ENTER,
  ROW_ENTER,
  ROW_EXIT,
  staggerDelay,
  waitForRowExit,
} from "@/lib/motion";
import { toast } from "sonner";
import { InitialsAvatar } from "@/components/ui/initials-avatar";

const KIND_BADGE: Record<PersonaLibraryEntry["kind"], string> = {
  preset: "Preset",
  user: "Custom",
};

export default function PersonasPage() {
  const {
    library,
    status,
    error,
    refresh,
    createEntry,
    deleteEntry,
    resetLibrary,
    updateEntry,
  } = usePersonaLibrary();

  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  /** The card being animated out of the grid. */
  const [exitingId, setExitingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"random" | "reset" | null>(null);
  const [editingEntry, setEditingEntry] = useState<PersonaLibraryEntry | null>(
    null,
  );
  const [editDraft, setEditDraft] = useState<PersonaConfig | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const sortedLibrary = useMemo(
    () => [...library].sort((a, b) => b.updatedAt - a.updatedAt),
    [library],
  );

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
    const [deleted] = await Promise.all([deleteEntry(id), waitForRowExit()]);
    if (!deleted) {
      // Put the card back — it is still in the library.
      setExitingId(null);
      toast.error(error ?? "Could not delete persona.");
    }
  };

  const openEdit = (entry: PersonaLibraryEntry) => {
    setEditingEntry(entry);
    setEditDraft({ ...entry.config });
  };

  const handleSaveEdit = async () => {
    if (!editingEntry || !editDraft) return;
    setSavingEdit(true);
    const updated = await updateEntry(editingEntry.id, editDraft);
    setSavingEdit(false);
    if (updated) {
      toast.success("Persona updated.");
      setEditingEntry(null);
      setEditDraft(null);
    } else {
      toast.error("Could not save persona.");
    }
  };

  const isLoading = status === "loading" && library.length === 0;

  return (
    <div className="p-8 space-y-8 bg-linear-to-br from-gray-50 via-white to-gray-50/50">
      <PageHeader
        eyebrow="Library"
        title="Personas"
        description="Tune the interviewer's culture, seniority, and style. Random them, edit them, save your favorites — your library is reused across all interviews."
        icon={<Users className="h-6 w-6" />}
        iconColor="purple"
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => void handleRandom()}
              disabled={busy === "random"}
            >
              <Dice5 className="mr-2 h-4 w-4" />
              {busy === "random" ? "Adding..." : "Random persona"}
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirmReset(true)}
              disabled={busy === "reset"}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Restore presets
            </Button>
          </>
        }
      />

      {isLoading ? (
        <PersonaGridSkeleton count={6} />
      ) : status === "error" ? (
        // Ahead of the empty check, and now the shared component. This was a
        // bare red banner *above* the content, so a failed load rendered the
        // banner and "Build your interviewer roster" at the same time — telling
        // the user both that something broke and that they own no personas.
        // It also had no retry, though the hook has always exported one.
        <ErrorStateCard
          title="Couldn't load your personas"
          description={error ?? "Something went wrong."}
          onRetry={() => void refresh()}
        />
      ) : sortedLibrary.length === 0 ? (
        <EmptyStateCard
          icon={<Users className="h-6 w-6" />}
          title="Build your interviewer roster"
          description="Spin up a random persona in one click, or jump into setup to craft someone who matches your target role."
          primaryAction={{
            label: "Generate random persona",
            onClick: () => void handleRandom(),
          }}
          secondaryAction={{
            label: "Open interview setup",
            href: "/simulate/setup",
          }}
        />
      ) : (
        <div
          className={cn(
            "grid md:grid-cols-2 lg:grid-cols-3 gap-6",
            CONTENT_ENTER,
          )}
        >
          {sortedLibrary.map((entry, index) => (
            // Editing *is* what this page is for, so the card body does it.
            // Before, the card was inert: the only affordances were two 32px
            // ghost icon buttons in a corner, and with six presets that meant
            // twelve tiny targets and a large dead area on every card.
            //
            // Delete moves to a top-right overflow menu, which is where every
            // other card in this app puts one — the round card, the document
            // pickers, and the persona picker in the setup wizard, which shows
            // these same six people.
            <Card
              key={entry.id}
              role="button"
              tabIndex={0}
              onClick={() => openEdit(entry)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  openEdit(entry);
                }
              }}
              aria-label={`Edit ${entry.config.name}`}
              className={cn(
                "group relative cursor-pointer shadow-soft transition-all duration-200 hover:shadow-soft-md hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                exitingId === entry.id ? ROW_EXIT : ROW_ENTER,
              )}
              style={exitingId === entry.id ? undefined : staggerDelay(index)}
            >
              <div className="absolute right-2 top-2">
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
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => openEdit(entry)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => setPendingDelete(entry.id)}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <CardHeader>
                <div className="flex items-start gap-4 pr-8">
                  <InitialsAvatar
                    name={entry.config.name}
                    size="lg"
                    shape="square"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-lg truncate">
                        {entry.config.name}
                      </CardTitle>
                      <Badge
                        variant={
                          entry.kind === "preset" ? "secondary" : "outline"
                        }
                      >
                        {KIND_BADGE[entry.kind]}
                      </Badge>
                    </div>
                    <CardDescription className="mt-1 truncate">
                      {entry.config.seniority}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Globe className="h-4 w-4 text-gray-400" />
                    <span className="truncate">
                      {entry.config.nationality} · {entry.config.industry}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Briefcase className="h-4 w-4 text-gray-400" />
                    <span className="capitalize truncate">
                      {entry.config.communicationStyle} ·{" "}
                      {entry.config.yearsExperience} yrs
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {entry.config.personalityTraits.slice(0, 3).map((trait) => (
                    <Badge
                      key={trait}
                      variant="outline"
                      className="bg-gray-50/80"
                    >
                      {trait}
                    </Badge>
                  ))}
                </div>

                {entry.config.boundaries.length > 0 && (
                  <p className="text-xs leading-5 text-gray-500">
                    <span className="font-medium text-gray-900">Dislikes:</span>{" "}
                    {entry.config.boundaries.slice(0, 3).join(", ")}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 pt-1">
                  <span>Strict {entry.config.strictness}/10</span>
                  <span>Warm {entry.config.warmth}/10</span>
                  <span>Pace {entry.config.pace ?? 5}/10</span>
                  <span>Pushback {entry.config.pushback ?? 5}/10</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={Boolean(editingEntry)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingEntry(null);
            setEditDraft(null);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit persona</DialogTitle>
            <DialogDescription>
              Changes are saved to your library and used in future interviews.
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
            <Button
              variant="outline"
              onClick={() => {
                setEditingEntry(null);
                setEditDraft(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSaveEdit()} disabled={savingEdit}>
              {savingEdit ? "Saving..." : "Save changes"}
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
