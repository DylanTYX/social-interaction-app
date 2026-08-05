"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  FileText,
  Mic,
  MessageSquare,
  Sliders,
  Rocket,
  GaugeCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
} from "@/components/ui/select";
import {
  BRIEF_QUICK_STARTS,
  CUSTOM_SCENARIO_VALUE,
  resolveScenarioForLaunch,
} from "@/lib/scenarios";
import { buildLaunchMetaFromSetup } from "@/lib/session-launch-meta";
import { Textarea } from "@/components/ui/textarea";
import {
  type PersonaConfig,
} from "@/lib/persona-engine";
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
import { PersonaStep } from "@/components/setup/persona-step";
import { FinalizeStep } from "@/components/setup/finalize-step";
import {
  AZURE_VOICE_OPTIONS,
} from "@/lib/speech-voices";
import {
  buildRoundScenarioDescription,
  buildRoundScenarioTitle,
  getCurrentRound,
} from "@/lib/interview-rounds";

type StepId = "mode" | "brief" | "loop" | "persona" | "finalize";

type StepDefinition = {
  id: StepId;
  title: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
};

const STEPS: StepDefinition[] = [
  {
    id: "mode",
    title: "Choose your practice mode",
    shortLabel: "Mode",
    description:
      "Decide whether you want to practice with typed or spoken responses.",
    icon: MessageSquare,
  },
  {
    id: "brief",
    title: "What are you preparing for?",
    shortLabel: "Brief",
    description:
      "Describe the role, company, or situation in your own words.",
    icon: FileText,
  },
  {
    id: "loop",
    title: "Build your interview",
    shortLabel: "Loop",
    description:
      "One focused round, or compose multiple rounds for a realistic loop.",
    icon: GaugeCircle,
  },
  {
    id: "persona",
    title: "Shape the interviewer",
    shortLabel: "Interviewer",
    description:
      "Pick a preset persona or fine-tune style, strictness, warmth, pace, and pushback.",
    icon: Sliders,
  },
  {
    id: "finalize",
    title: "Final tune & launch",
    shortLabel: "Launch",
    description:
      "Confirm your settings, run a quick mic check if needed, and start the session.",
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="flex items-center gap-3 text-sm text-gray-500">
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
        Preparing setup...
      </div>
    </div>
  );
}

function SetupWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentStep, setCurrentStep] = useState<StepId>("mode");
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
          streamValue === null
            ? stored.streamResponses
            : streamValue === "1",
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
  const activeStep = STEPS[stepIndex];

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

  const goNext = () => {
    if (isLastStep) {
      void launchInterview();
      return;
    }
    setCurrentStep(STEPS[stepIndex + 1].id);
  };

  const goBack = () => {
    if (isFirstStep) {
      router.push("/dashboard");
      return;
    }
    setCurrentStep(STEPS[stepIndex - 1].id);
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
              rawText: setup.jobDescription.rawText,
            }),
          });

          if (!jdResponse.ok) {
            const detail = (await jdResponse
              .json()
              .catch(() => null)) as { error?: string } | null;
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
            const detail = (await resumeResponse
              .json()
              .catch(() => null)) as { error?: string } | null;
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

      if (!response.ok) {
        const detail = (await response
          .json()
          .catch(() => null)) as { error?: string } | null;
        throw new Error(
          detail?.error ?? `Failed to start session (HTTP ${response.status}).`,
        );
      }

      const { session } = (await response.json()) as { session: { id: string } };

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

  const canProceedFromStep = (() => {
    if (currentStep === "mode") {
      return setup.practiceMode === "text" || setup.practiceMode === "voice";
    }
    if (currentStep === "brief") {
      return (setup.customScenarioBrief?.trim().length ?? 0) >= 20;
    }
    if (currentStep === "persona") {
      return (
        setup.personaConfig.name.trim().length > 0 &&
        setup.personaConfig.nationality.trim().length > 0 &&
        setup.personaConfig.industry.trim().length > 0 &&
        setup.personaConfig.seniority.trim().length > 0
      );
    }
    if (currentStep === "finalize") {
      if (setup.jobDescription.enabled) {
        if (setup.jobDescription.mode === "paste") {
          if (setup.jobDescription.rawText.trim().length < 80) return false;
        } else if (!setup.jobDescription.savedId) {
          return false;
        }
      }
      if (setup.resume.enabled) {
        if (setup.resume.mode === "paste") {
          if (setup.resume.rawText.trim().length < 80) return false;
        } else if (!setup.resume.savedId) {
          return false;
        }
      }
    }
    return true;
  })();

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(219,234,254,0.9),transparent_35%),radial-gradient(circle_at_top_right,rgba(207,250,254,0.6),transparent_28%),linear-gradient(to_bottom,#f8fafc,#ffffff_52%,#f8fbff)]">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 right-0 h-72 w-72 rounded-full bg-blue-200/20 blur-3xl" />
        <div className="absolute top-40 -left-16 h-80 w-80 rounded-full bg-cyan-200/25 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              className="gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Button>
          </Link>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            Step {stepIndex + 1} of {totalSteps}
          </Badge>
        </div>

        <Stepper currentStepId={currentStep} onStepSelect={setCurrentStep} />

        <Card className="mt-6 border-gray-200/80 bg-white/85 shadow-soft backdrop-blur">
          <CardHeader className="pb-4">
            <div className="space-y-1">
              <CardTitle className="text-2xl tracking-tight">
                {activeStep.title}
              </CardTitle>
              <CardDescription className="text-sm text-gray-600">
                {activeStep.description}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-8">
            {currentStep === "mode" && (
              <ModeStep mode={setup.practiceMode} onChange={updateMode} />
            )}

            {currentStep === "brief" && (
              <BriefStep
                customBrief={setup.customScenarioBrief ?? ""}
                onChange={(customScenarioBrief) =>
                  updateSetup({
                    customScenarioBrief,
                    scenarioValue: CUSTOM_SCENARIO_VALUE,
                  })
                }
              />
            )}

            {currentStep === "loop" && (
              <LoopStep
                value={setup.interviewLoop}
                practiceMode={setup.practiceMode}
                jobDescriptionText={
                  setup.jobDescription.enabled
                    ? setup.jobDescription.rawText
                    : ""
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

            {currentStep === "finalize" && (
              <FinalizeStep
                setup={setup}
                onUpdate={updateSetup}
                onMicCheck={checkMicrophone}
                microphoneStatus={microphoneStatus}
                microphoneMessage={microphoneMessage}
                voiceOptions={azureVoiceOptions}
              />
            )}

            {(launchError || personaLibraryError) && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {launchError ?? personaLibraryError}
              </div>
            )}

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="ghost"
                onClick={goBack}
                className="gap-2 text-gray-600 hover:text-gray-900"
              >
                <ChevronLeft className="h-4 w-4" />
                {isFirstStep ? "Cancel" : "Back"}
              </Button>

              <div className="flex items-center gap-3">
                {isLastStep && (
                  <p className="text-xs text-gray-500">
                    Saved automatically. You can come back any time.
                  </p>
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
          </CardContent>
        </Card>
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
    <ol className="flex flex-col gap-4 rounded-2xl border border-gray-200/70 bg-white/80 p-4 shadow-soft backdrop-blur sm:flex-row sm:items-center sm:gap-2">
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
              className={`flex h-14 w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-all duration-200 ${
                isActive
                  ? "border-blue-300 bg-blue-50 shadow-soft-md"
                  : isCompleted
                    ? "border-emerald-200/70 bg-emerald-50/70 hover:bg-emerald-100/70"
                    : "border-gray-200/70 bg-white/70 text-gray-400 cursor-default"
              }`}
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                  isActive
                    ? "bg-blue-500 text-white"
                    : isCompleted
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-100 text-gray-500"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Icon className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0">
                <p
                  className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
                    isActive
                      ? "text-blue-700"
                      : isCompleted
                        ? "text-emerald-700"
                        : "text-gray-400"
                  }`}
                >
                  Step {index + 1}
                </p>
                <p
                  className={`truncate text-sm font-medium ${
                    isActive
                      ? "text-gray-900"
                      : isCompleted
                        ? "text-emerald-900"
                        : "text-gray-500"
                  }`}
                >
                  {step.shortLabel}
                </p>
              </div>
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

function ModeStep({
  mode,
  onChange,
}: {
  mode: PracticeMode;
  onChange: (mode: PracticeMode) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {[
        {
          value: "text" as const,
          title: "Text interview",
          description:
            "Type your responses. You get up to 5 minutes per answer. Best for crafted, deliberate answers.",
          highlights: [
            "Optional token streaming",
            "Markdown-rendered responses",
            "Easy to revisit & re-read",
          ],
          icon: MessageSquare,
          gradient: "from-blue-50 via-white to-cyan-50/70",
          accent: "bg-blue-500",
        },
        {
          value: "voice" as const,
          title: "Voice interview",
          description:
            "Speak your answer and hear the interviewer reply. Closer to a real interview, but needs a microphone.",
          highlights: [
            "Real-time speech-to-text",
            "Interviewer voice playback",
            "Choose from neural voices",
          ],
          icon: Mic,
          gradient: "from-violet-50 via-white to-blue-50/70",
          accent: "bg-violet-500",
        },
      ].map((option) => {
        const Icon = option.icon;
        const isActive = mode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border p-5 text-left transition-all duration-200 ${
              isActive
                ? "border-blue-300 bg-linear-to-br shadow-soft-md ring-2 ring-blue-200"
                : "border-gray-200/80 bg-linear-to-br hover:border-blue-200 hover:shadow-soft"
            } ${option.gradient}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-soft ${option.accent}`}
              >
                <Icon className="h-5 w-5" />
              </div>
              {isActive && (
                <Badge variant="default" className="rounded-full">
                  Selected
                </Badge>
              )}
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold text-gray-900">
                {option.title}
              </h3>
              <p className="text-sm leading-6 text-gray-600">
                {option.description}
              </p>
            </div>
            <ul className="space-y-1.5">
              {option.highlights.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 text-xs text-gray-600"
                >
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}

function BriefStep({
  customBrief,
  onChange,
}: {
  customBrief: string;
  onChange: (brief: string) => void;
}) {
  const charCount = customBrief.trim().length;
  const isValid = charCount >= 20;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200/80 bg-white/80 p-4 space-y-3">
        <Label htmlFor="interview-brief" className="text-sm font-medium">
          Tell the interviewer what you&apos;re preparing for
        </Label>
        <Textarea
          id="interview-brief"
          value={customBrief}
          onChange={(event) => onChange(event.target.value)}
          placeholder='e.g. "Senior data analyst at a mid-size SaaS company. Expecting questions on SQL, dashboards, stakeholder communication, and a behavioral round on cross-team conflict."'
          className="min-h-32 resize-y leading-6"
        />
        <div className="flex items-center justify-between text-xs">
          <span className={isValid ? "text-emerald-600" : "text-gray-500"}>
            {charCount} character{charCount === 1 ? "" : "s"} · at least 20
            required
          </span>
          <span className="text-gray-400">
            The interviewer drifts naturally between topics — round types
            below set the rubric, this brief sets the content.
          </span>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100/70 bg-blue-50/40 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700/80">
          Quick starts
        </p>
        <p className="mt-1 text-xs text-blue-900/70">
          Click to pre-fill — these are starting points, not constraints.
          Edit freely.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {BRIEF_QUICK_STARTS.map((chip) => {
            const isActive = customBrief.trim() === chip.template.trim();
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => onChange(chip.template)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-blue-400 bg-blue-600 text-white shadow-sm"
                    : "border-blue-200 bg-white/80 text-blue-700 hover:bg-blue-100"
                }`}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
