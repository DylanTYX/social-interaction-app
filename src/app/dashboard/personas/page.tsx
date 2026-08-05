"use client";

import { useMemo, useState } from "react";
import {
  Briefcase,
  Dice5,
  Globe,
  RotateCcw,
  Pencil,
  Trash2,
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
import { PersonaGridSkeleton } from "@/components/dashboard/page-skeletons";
import { usePersonaLibrary } from "@/hooks/use-persona-library";
import {
  generateRandomPersonaConfig,
  type PersonaLibraryEntry,
} from "@/lib/persona-library";
import { PersonaConfigEditor } from "@/components/persona/persona-config-editor";
import type { PersonaConfig } from "@/lib/persona-engine";
import { toast } from "sonner";
import { initialsFromName } from "@/lib/format";

const KIND_BADGE: Record<PersonaLibraryEntry["kind"], string> = {
  preset: "Preset",
  user: "Custom",
};

export default function PersonasPage() {
  const {
    library,
    status,
    error,
    createEntry,
    deleteEntry,
    resetLibrary,
    updateEntry,
  } = usePersonaLibrary();

  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
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
    const deleted = await deleteEntry(id);
    if (!deleted) {
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

      {status === "error" && error && (
        <Card className="border-red-200 bg-red-50 text-red-900">
          <CardContent className="py-4 text-sm">{error}</CardContent>
        </Card>
      )}

      {isLoading ? (
        <PersonaGridSkeleton count={6} />
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
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedLibrary.map((entry) => (
            <Card
              key={entry.id}
              className="group border border-gray-200/60 hover:border-purple-200 hover:shadow-soft-md transition-all duration-200 hover-lift"
            >
              <CardHeader>
                <div className="flex items-start gap-4">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-base font-semibold shadow-soft-md shrink-0">
                    {initialsFromName(entry.config.name)}
                  </div>
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
                  {entry.config.personalityTraits
                    .slice(0, 3)
                    .map((trait) => (
                      <Badge
                        key={trait}
                        variant="outline"
                        className="bg-gray-50/80"
                      >
                        {trait}
                      </Badge>
                    ))}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 pt-1">
                  <span>Strict {entry.config.strictness}/10</span>
                  <span>Warm {entry.config.warmth}/10</span>
                  <span>Pace {entry.config.pace ?? 5}/10</span>
                  <span>Pushback {entry.config.pushback ?? 5}/10</span>
                </div>

                <div className="flex items-center justify-end gap-1 pt-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(entry)}
                    aria-label="Edit persona"
                  >
                    <Pencil className="h-4 w-4 text-gray-500" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPendingDelete(entry.id)}
                    aria-label="Delete persona"
                  >
                    <Trash2 className="h-4 w-4 text-gray-500" />
                  </Button>
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
