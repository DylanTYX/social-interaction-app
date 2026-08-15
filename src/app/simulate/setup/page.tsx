"use client";

import { readJson } from "@/lib/api/fetch-json";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Sliders,
  Rocket,
  Sparkles,
  GaugeCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  BRIEF_QUICK_STARTS,
  CUSTOM_SCENARIO_VALUE,
  resolveScenarioForLaunch,
  unfilledPlaceholders,
} from "@/lib/scenarios";
import { buildLaunchMetaFromSetup } from "@/lib/session-launch-meta";
import { type PersonaConfig } from "@/lib/persona-engine";
import {
  createDefaultInterviewSetup,
  saveInterviewLaunch,
  loadInterviewSetup,
  getSetupHref,
  saveInterviewSetup,
  type InterviewSetupState,
  type PracticeMode,
} from "@/lib/interview-setup";
import {
  generateRandomPersonaConfig,
  type PersonaLibraryEntry,
} from "@/lib/persona-library";
import { usePersonaLibrary } from "@/hooks/use-persona-library";
import { LoopStep } from "@/components/setup/loop-step";
import { ContextStep } from "@/components/setup/context-step";
import { PageHeader } from "@/components/dashboard/page-header";
import { PersonaStep } from "@/components/setup/persona-step";
import { FinalizeStep } from "@/components/setup/finalize-step";
import { AZURE_VOICE_OPTIONS } from "@/lib/speech-voices";
import { cn } from "@/lib/utils";
import {
  buildRoundScenarioDescription,
  buildRoundScenarioTitle,
  getCurrentRound,
} from "@/lib/interview-rounds";

type StepId = "context" | "rounds" | "persona" | "review";

type StepDefinition = {
  id: StepId;
  title: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
};

const STEPS: StepDefinition[] = [
  {
    id: "context",
    title: "What are you preparing for?",
    shortLabel: "Context",
    icon: FileText,
  },
  {
    id: "rounds",
    title: "Build your interview",
    shortLabel: "Rounds",
    icon: GaugeCircle,
  },
  {
    id: "persona",
    title: "Shape the interviewer",
    shortLabel: "Interviewer",
    icon: Sliders,
  },
  {
    id: "review",
    title: "Review and launch",
    shortLabel: "Review",
    icon: Rocket,
  },
];

export default function SetupPage() {
  return (
    <Suspense fallback={<SetupLoadingFallback />}>
      <SetupWizard />
    </Suspense>
  );
}

function SetupLoadingFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span className="h-2 w-2 animate-breathe rounded-full bg-blue-500" />
        Preparing setup...
      </div>
    </div>
  );
}

function SetupWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState<StepId>("context");
  const [microphoneStatus, setMicrophoneStatus] = useState<
    "idle" | "checking" | "ready" | "failed"
  >("idle");
  const [microphoneMessage, setMicrophoneMessage] = useState<string | null>(
    null,
  );
  // Initialize from server-safe defaults only. Reading localStorage here would
  // diverge between the server (no storage) and the client and trip React's
  // hydration check, so the stored setup is loaded in an effect after mount.
  const [setup, setSetup] = useState<InterviewSetupState>(() => {
    const base = createDefaultInterviewSetup();
    const streamValue = searchParams.get("stream");
    const modeValue = searchParams.get("mode");

    return {
      ...base,
      streamResponses:
        streamValue === null ? base.streamResponses : streamValue === "1",
      practiceMode:
        modeValue === "voice" || modeValue === "text"
          ? modeValue
          : base.practiceMode,
    };
  });
  const [hydrated, setHydrated] = useState(false);

  // Hydrate the saved setup from localStorage once, after the first client
  // render, so SSR and the initial client render stay identical.
  useEffect(() => {
    const stored = loadInterviewSetup();
    const streamValue = searchParams.get("stream");
    const modeValue = searchParams.get("mode");

    if (stored) {
      // Reading localStorage during render would make SSR and the first
      // client render disagree; an effect is the supported way to do this.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSetup({
        ...stored,
        streamResponses:
          streamValue === null ? stored.streamResponses : streamValue === "1",
        practiceMode:
          modeValue === "voice" || modeValue === "text"
            ? modeValue
            : stored.practiceMode,
      });
    }
    setHydrated(true);
    // Only run on mount; searchParams is stable within this view.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    library: personaLibrary,
    status: personaLibraryStatus,
    error: personaLibraryError,
    createEntry: createPersonaEntryAsync,
    updateEntry: updatePersonaEntryAsync,
    duplicateEntry: duplicatePersonaEntryAsync,
    deleteEntry: deletePersonaEntryAsync,
    resetLibrary: resetPersonaLibraryAsync,
  } = usePersonaLibrary();

  const personaLibraryLoading = personaLibraryStatus === "loading";

  // Persist setup as the user moves through the wizard so a refresh keeps
  // their progress. Wait until after the stored setup is hydrated so we don't
  // clobber it with the initial defaults.
  useEffect(() => {
    if (!hydrated) return;
    saveInterviewSetup(setup);
  }, [setup, hydrated]);

  // A static catalogue, so no client-only guard and no memo are needed. It is
  // deliberately imported from `speech-voices` rather than `speechService`:
  // the latter pulls in the Azure SDK (and its Node-only cert-checking
  // dependencies) which this page never uses.
  const azureVoiceOptions = AZURE_VOICE_OPTIONS;

  const stepIndex = STEPS.findIndex((step) => step.id === currentStep);
  const totalSteps = STEPS.length;
  const isLastStep = stepIndex === totalSteps - 1;
  const isFirstStep = stepIndex === 0;

  const updateSetup = (partial: Partial<InterviewSetupState>) => {
    setSetup((current) => ({ ...current, ...partial }));
  };

  const updatePersona = (partial: Partial<PersonaConfig>) => {
    setSetup((current) => ({
      ...current,
      personaConfig: { ...current.personaConfig, ...partial },
      // Editing the active persona detaches it from any library entry until
      // the user explicitly saves the changes back to the library.
      personaLibraryId: undefined,
    }));
  };

  const updateMode = (practiceMode: PracticeMode) => {
    updateSetup({
      practiceMode,
      interviewLoop: {
        ...setup.interviewLoop,
        rounds: setup.interviewLoop.rounds.map((round) => ({
          ...round,
          practiceMode,
        })),
      },
    });
  };

  const handlePickPersona = (entry: PersonaLibraryEntry) => {
    setSetup((current) => ({
      ...current,
      personaConfig: { ...entry.config },
      personaLibraryId: entry.id,
    }));
  };

  const handleRandomizePersona = () => {
    const random = generateRandomPersonaConfig();
    setSetup((current) => ({
      ...current,
      personaConfig: random,
      personaLibraryId: undefined,
    }));
  };

  const handleSavePersona = async (name?: string) => {
    const trimmedName = (name ?? setup.personaConfig.name).trim();
    if (!trimmedName) return;
    const created = await createPersonaEntryAsync({
      ...setup.personaConfig,
      name: trimmedName,
    });
    if (!created) return;
    setSetup((current) => ({
      ...current,
      personaConfig: created.config,
      personaLibraryId: created.id,
    }));
  };

  const handleUpdatePersonaInLibrary = async (entryId: string) => {
    const trimmedName = setup.personaConfig.name.trim();
    if (!trimmedName) return;
    const updated = await updatePersonaEntryAsync(entryId, {
      ...setup.personaConfig,
      name: trimmedName,
    });
    if (!updated) return;
    setSetup((current) => ({
      ...current,
      personaConfig: updated.config,
      personaLibraryId: updated.id,
    }));
  };

  const handleDuplicatePersona = async (entryId: string) => {
    const original = personaLibrary.find((entry) => entry.id === entryId);
    if (!original) return;
    const copy = await duplicatePersonaEntryAsync(original);
    if (!copy) return;
    setSetup((current) => ({
      ...current,
      personaConfig: { ...copy.config },
      personaLibraryId: copy.id,
    }));
  };

  const handleDeletePersona = async (entryId: string) => {
    const ok = await deletePersonaEntryAsync(entryId);
    if (!ok) return;
    if (setup.personaLibraryId === entryId) {
      setSetup((current) => ({ ...current, personaLibraryId: undefined }));
    }
  };

  const handleResetLibrary = async () => {
    await resetPersonaLibraryAsync();
    setSetup((current) => ({ ...current, personaLibraryId: undefined }));
  };

  const [isLaunching, setIsLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  /**
   * Which way the wizard is moving, so the incoming step slides in from the
   * side it came from. Derived from the target index rather than set by each
   * caller, because the stepper pills can jump to any earlier step directly —
   * hand-setting a direction in `goNext`/`goBack` alone would have left those
   * jumps animating forwards while moving backwards.
   */
  const [stepDirection, setStepDirection] = useState<"forward" | "back">(
    "forward",
  );

  const goToStep = (next: StepId) => {
    const nextIndex = STEPS.findIndex((step) => step.id === next);
    setStepDirection(nextIndex < stepIndex ? "back" : "forward");
    setCurrentStep(next);
  };

  const goNext = () => {
    if (isLastStep) {
      void launchInterview();
      return;
    }
    goToStep(STEPS[stepIndex + 1].id);
  };

  const goBack = () => {
    if (isFirstStep) {
      router.push("/dashboard");
      return;
    }
    goToStep(STEPS[stepIndex - 1].id);
  };

  const launchInterview = async () => {
    setLaunchError(null);
    setIsLaunching(true);

    try {
      saveInterviewSetup(setup);

      const scenario = resolveScenarioForLaunch(setup);
      const activeRound = getCurrentRound(setup.interviewLoop);
      const launchPracticeMode = setup.interviewLoop.enabled
        ? activeRound.practiceMode
        : setup.practiceMode;
      const scenarioTitle = buildRoundScenarioTitle(
        scenario.title,
        setup.interviewLoop,
      );
      const scenarioDescription = buildRoundScenarioDescription(
        scenario.description,
        setup.interviewLoop,
      );
      let jobDescriptionId: string | null = null;
      let jobDescriptionTitle: string | null = setup.jobDescription.savedTitle;

      if (setup.jobDescription.enabled) {
        if (setup.jobDescription.mode === "paste") {
          if (setup.jobDescription.rawText.trim().length < 80) {
            throw new Error(
              "Paste at least 80 characters of job description text.",
            );
          }

          const jdResponse = await fetch("/api/job-descriptions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roleTitle: setup.jobDescription.roleTitle,
              company: setup.jobDescription.company,
              sourceUrl: setup.jobDescription.sourceUrl,
              rawText: setup.jobDescription.rawText,
            }),
          });

          if (!jdResponse.ok) {
            const detail = (await jdResponse.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(
              detail?.error ??
                `Failed to prepare job description context (HTTP ${jdResponse.status}).`,
            );
          }

          const { jobDescription } = (await jdResponse.json()) as {
            jobDescription: { id: string; title: string };
          };
          jobDescriptionId = jobDescription.id;
          jobDescriptionTitle = jobDescription.title;
        } else if (
          setup.jobDescription.mode === "upload" ||
          setup.jobDescription.mode === "saved"
        ) {
          if (!setup.jobDescription.savedId) {
            throw new Error(
              setup.jobDescription.mode === "upload"
                ? "Upload a PDF before launching."
                : "Pick a saved job description before launching.",
            );
          }
          jobDescriptionId = setup.jobDescription.savedId;
        }
      }

      let resumeId: string | null = null;
      let resumeTitle: string | null = setup.resume.savedTitle;

      if (setup.resume.enabled) {
        if (setup.resume.mode === "paste") {
          if (setup.resume.rawText.trim().length < 80) {
            throw new Error("Paste at least 80 characters of resume text.");
          }

          const resumeResponse = await fetch("/api/resumes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rawText: setup.resume.rawText }),
          });

          if (!resumeResponse.ok) {
            const detail = (await resumeResponse.json().catch(() => null)) as {
              error?: string;
            } | null;
            throw new Error(
              detail?.error ??
                `Failed to prepare resume context (HTTP ${resumeResponse.status}).`,
            );
          }

          const { resume } = (await resumeResponse.json()) as {
            resume: { id: string; title: string };
          };
          resumeId = resume.id;
          resumeTitle = resume.title;
        } else if (
          setup.resume.mode === "upload" ||
          setup.resume.mode === "saved"
        ) {
          if (!setup.resume.savedId) {
            throw new Error(
              setup.resume.mode === "upload"
                ? "Upload a resume PDF before launching."
                : "Pick a saved resume before launching.",
            );
          }
          resumeId = setup.resume.savedId;
        }
      }

      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practiceMode: launchPracticeMode,
          scenarioValue: setup.scenarioValue,
          scenarioTitle,
          scenarioDescription,
          personaId: setup.personaLibraryId ?? null,
          jobDescriptionId,
          resumeId,
          personaConfig: setup.personaConfig,
          launchMeta: buildLaunchMetaFromSetup(setup),
        }),
      });

      const { session } = await readJson<{ session: { id: string } }>(response);

      saveInterviewLaunch({
        ...setup,
        practiceMode: launchPracticeMode,
        sessionId: session.id,
        jobDescription: {
          ...setup.jobDescription,
          savedId: jobDescriptionId,
          savedTitle: jobDescriptionTitle,
        },
        resume: {
          ...setup.resume,
          savedId: resumeId,
          savedTitle: resumeTitle,
        },
      });
      router.push(getSetupHref(setup, session.id));
    } catch (error) {
      setLaunchError(
        error instanceof Error
          ? error.message
          : "Unable to start the interview right now.",
      );
    } finally {
      setIsLaunching(false);
    }
  };

  const checkMicrophone = async () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      setMicrophoneStatus("failed");
      setMicrophoneMessage(
        "Microphone API is not available in this environment.",
      );
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicrophoneStatus("failed");
      setMicrophoneMessage(
        "Your browser does not expose microphone APIs. Try a recent Chrome, Edge, or Safari over HTTPS.",
      );
      return;
    }

    setMicrophoneStatus("checking");
    setMicrophoneMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      stream.getTracks().forEach((track) => track.stop());
      setMicrophoneStatus("ready");
      setMicrophoneMessage(
        "Microphone access verified — you're ready to record.",
      );
      setSetup((current) => ({
        ...current,
        voiceConfig: {
          ...current.voiceConfig,
          microphoneChecked: true,
        },
      }));
    } catch (error) {
      let helpfulMessage = "Microphone access was denied or unavailable.";

      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError") {
          helpfulMessage =
            "Permission denied. Click the lock icon in your browser address bar to allow microphone access, then try again.";
        } else if (error.name === "NotFoundError") {
          helpfulMessage =
            "No microphone device was detected. Connect or select a microphone, then try again.";
        } else if (error.name === "NotReadableError") {
          helpfulMessage =
            "Your microphone is currently in use by another application.";
        }
      }

      setMicrophoneStatus("failed");
      setMicrophoneMessage(helpfulMessage);
      setSetup((current) => ({
        ...current,
        voiceConfig: {
          ...current.voiceConfig,
          microphoneChecked: false,
        },
      }));
    }
  };

  /**
   * Why the Continue button is disabled, or null when it is not.
   *
   * This used to return a bare boolean, so the button simply went dead with no
   * indication of what was missing — a dead end on a form that is mostly
   * optional fields. Returning the reason lets the UI say it.
   *
   * The document checks moved from the last step to the first, along with the
   * pickers themselves.
   */
  // `null` means the step is complete. A string means it is not — and an
  // *empty* string means it is not, but there is nothing worth saying yet.
  const blockedReason = ((): string | null => {
    if (currentStep === "context") {
      const brief = setup.customScenarioBrief ?? "";
      const briefLength = brief.trim().length;

      // Length is not completeness. A quick-start template clears 20 characters
      // while still reading "…for a [role] role", and that shipped straight
      // into a live interview.
      const placeholders = unfilledPlaceholders(brief);
      if (briefLength >= 20 && placeholders.length > 0) {
        return placeholders.length === 1
          ? `Replace ${placeholders[0]} with the real detail.`
          : `Replace ${placeholders.slice(0, 2).join(" and ")} with real details.`;
      }

      if (briefLength < 20) {
        // Silent while the box is still empty. The brief starts blank, so
        // showing this on arrival meant the first step opened by telling the
        // user off for not having done anything yet. Once they have started
        // typing, saying how far they have to go is genuinely useful.
        return briefLength === 0
          ? ""
          : "Describe the role in at least 20 characters.";
      }
      if (setup.jobDescription.enabled) {
        if (setup.jobDescription.mode === "paste") {
          if (setup.jobDescription.rawText.trim().length < 80) {
            return "Paste at least 80 characters of the job description, or turn it off.";
          }
        } else if (!setup.jobDescription.savedId) {
          return "Choose or upload a job description, or turn it off.";
        }
      }
      if (setup.resume.enabled) {
        if (setup.resume.mode === "paste") {
          if (setup.resume.rawText.trim().length < 80) {
            return "Paste at least 80 characters of your CV, or turn it off.";
          }
        } else if (!setup.resume.savedId) {
          return "Choose or upload a CV, or turn it off.";
        }
      }
      return null;
    }
    if (currentStep === "persona") {
      const missing = (
        [
          ["name", "a display name"],
          ["nationality", "a nationality"],
          ["industry", "an industry"],
          ["seniority", "a seniority"],
        ] as const
      ).filter(([field]) => setup.personaConfig[field].trim().length === 0);
      if (missing.length > 0) {
        return `Give the interviewer ${missing.map(([, label]) => label).join(", ")}.`;
      }
    }
    /**
     * A voice interview may not start on an unverified microphone.
     *
     * `microphoneChecked` existed but only ever rendered a label — it gated
     * nothing — and `requestMicrophoneAccess()` was written and never called.
     * So the launch button was live with the panel reading "Microphone has not
     * been checked yet", and the failure surfaced *after* the interviewer had
     * already greeted the candidate out loud. The check itself is one click and
     * already implemented; it just was not required.
     */
    if (currentStep === "review" && setup.practiceMode === "voice") {
      if (!setup.voiceConfig.microphoneChecked) {
        return "Run the microphone check before starting a voice interview.";
      }
    }
    return null;
  })();

  const canProceedFromStep = blockedReason === null;

  return (
    // No `min-h-screen` and no background: `AppShell`'s <main> owns the scroll
    // container and the page background now, exactly as it does for every
    // /dashboard page.
    <div className="mx-auto max-w-5xl space-y-8 p-8">
      <PageHeader
        eyebrow="Practice"
        title="Interview practice"
        description="Four steps, then you are interviewing."
        icon={<Sparkles className="h-6 w-6" />}
        iconColor="blue"
      />

      <Stepper currentStepId={currentStep} onStepSelect={goToStep} />

      {/* No CardHeader. The stepper already names the step, and every
            section inside carries its own CardTitle sitting directly above its
            controls — so a step-level title/description pair only restated
            what was above it and what was below it. On the first step it
            repeated the inner heading word for word. */}
      <div className="space-y-6">
        {/* Keyed on the step so React remounts this subtree and the entrance
            animation actually replays — a class change alone would not restart
            it. The direction is what makes the wizard feel like one surface you
            are moving along rather than four unrelated screens; a 1rem slide
            stays inside the container's `p-8`, so it cannot cause a horizontal
            scrollbar mid-transition.

            Note that this div sits between the `space-y-6` above and the step
            components, so it — not they — is what that gap now spaces. Each
            step therefore has to own the rhythm between its own cards, which
            all four now do. `ContextStep` did not, and adding this wrapper
            silently collapsed its four cards together. */}
        <div
          key={currentStep}
          className={cn(
            "animate-in fade-in-0 duration-300 ease-soft",
            stepDirection === "forward"
              ? "slide-in-from-right-4"
              : "slide-in-from-left-4",
          )}
        >
          {currentStep === "context" && (
            <ContextStep
              setup={setup}
              quickStarts={BRIEF_QUICK_STARTS}
              onModeChange={updateMode}
              onUpdate={(partial) =>
                updateSetup(
                  "customScenarioBrief" in partial
                    ? { ...partial, scenarioValue: CUSTOM_SCENARIO_VALUE }
                    : partial,
                )
              }
            />
          )}

          {currentStep === "rounds" && (
            <LoopStep
              value={setup.interviewLoop}
              practiceMode={setup.practiceMode}
              jobDescriptionText={
                setup.jobDescription.enabled ? setup.jobDescription.rawText : ""
              }
              personaLibrary={personaLibrary}
              onChange={(interviewLoop) => updateSetup({ interviewLoop })}
            />
          )}

          {currentStep === "persona" && (
            <PersonaStep
              value={setup.personaConfig}
              activeLibraryId={setup.personaLibraryId}
              library={personaLibrary}
              isLoading={personaLibraryLoading}
              onPatch={updatePersona}
              onPick={handlePickPersona}
              onRandomize={handleRandomizePersona}
              onSaveAsNew={handleSavePersona}
              onUpdateLibraryEntry={handleUpdatePersonaInLibrary}
              onDuplicate={handleDuplicatePersona}
              onDelete={handleDeletePersona}
              onResetLibrary={handleResetLibrary}
            />
          )}

          {currentStep === "review" && (
            <FinalizeStep
              setup={setup}
              onUpdate={updateSetup}
              onMicCheck={checkMicrophone}
              microphoneStatus={microphoneStatus}
              microphoneMessage={microphoneMessage}
              voiceOptions={azureVoiceOptions}
            />
          )}
        </div>

        {(launchError || personaLibraryError) && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {launchError ?? personaLibraryError}
          </div>
        )}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            onClick={goBack}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
            {isFirstStep ? "Cancel" : "Back"}
          </Button>

          <div className="flex items-center gap-3">
            {/* Previously the button just went disabled with no reason
                    given, which on a step of mostly-optional fields is a dead
                    end. */}
            {canProceedFromStep
              ? isLastStep && (
                  <p className="text-xs text-muted-foreground">
                    Saved automatically. You can come back any time.
                  </p>
                )
              : blockedReason && (
                  <p className="text-xs text-destructive">{blockedReason}</p>
                )}
            <Button
              onClick={goNext}
              disabled={!canProceedFromStep || isLaunching}
              className="gap-2 shadow-soft-md hover:shadow-soft-lg transition-all duration-200"
            >
              {isLastStep
                ? isLaunching
                  ? "Starting..."
                  : "Begin interview"
                : "Continue"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stepper({
  currentStepId,
  onStepSelect,
}: {
  currentStepId: StepId;
  onStepSelect: (stepId: StepId) => void;
}) {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStepId);

  return (
    <ol className="flex flex-col gap-2 rounded-xl border border-border bg-white p-3 shadow-soft sm:flex-row sm:items-center">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isActive = step.id === currentStepId;
        const isCompleted = index < currentIndex;
        const isReachable = index <= currentIndex;

        const isLast = index === STEPS.length - 1;
        return (
          <li key={step.id} className="flex flex-1 items-stretch gap-3">
            <button
              type="button"
              disabled={!isReachable}
              onClick={() => isReachable && onStepSelect(step.id)}
              className={`flex h-11 w-full items-center gap-2.5 rounded-lg border px-3 text-left transition-all duration-200 ${
                isActive
                  ? "border-blue-300 bg-blue-50 shadow-soft-md"
                  : isCompleted
                    ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                    : "border-border bg-white text-muted-foreground cursor-default"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors duration-200 ${
                  isActive
                    ? "bg-blue-500 text-white"
                    : isCompleted
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {/* Completing a step is the one moment in this wizard worth
                    marking, so the tick pops rather than replacing the step
                    icon between frames. Keyed so the swap is a mount. */}
                {isCompleted ? (
                  <CheckCircle2
                    key="done"
                    className="h-4 w-4 animate-in zoom-in-50 duration-200 ease-soft"
                  />
                ) : (
                  <Icon key="pending" className="h-4 w-4" />
                )}
              </span>
              <p
                className={`min-w-0 truncate text-sm font-medium ${
                  isActive
                    ? "text-foreground"
                    : isCompleted
                      ? "text-emerald-900"
                      : "text-muted-foreground"
                }`}
              >
                {step.shortLabel}
              </p>
            </button>
            <span
              aria-hidden
              className={`hidden h-px w-6 self-center sm:block ${
                isLast
                  ? "invisible"
                  : index < currentIndex
                    ? "bg-emerald-300"
                    : "bg-gray-200"
              }`}
            />
          </li>
        );
      })}
    </ol>
  );
}
