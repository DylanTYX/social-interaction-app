"use client";

import { readJson } from "@/lib/api/fetch-json";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BRIEF_QUICK_STARTS,
  CUSTOM_SCENARIO_VALUE,
  resolveScenarioForLaunch,
  unfilledPlaceholders,
} from "@/lib/scenarios";
import { fetchWithRetry } from "@/lib/api/fetch-retry";
import { buildLaunchMetaFromSetup } from "@/lib/session-launch-meta";
import { type PersonaConfig } from "@/lib/persona-engine";
import { toast } from "sonner";
import {
  createDefaultInterviewSetup,
  saveInterviewLaunch,
  loadInterviewSetup,
  getSetupHref,
  resolveLaunchAttachment,
  saveInterviewSetup,
  type InterviewSetupState,
  type PracticeMode,
} from "@/lib/interview-setup";
import {
  generateRandomPersonaConfig,
  type PersonaLibraryEntry,
  personaConfigEquals,
  personaIdentityComplete,
} from "@/lib/persona-library";
import { usePersonaLibrary } from "@/hooks/use-persona-library";
import { useJobDescriptions } from "@/hooks/use-job-descriptions";
import { useResumes } from "@/hooks/use-resumes";
import { LoopStep } from "@/components/setup/loop-step";
import { ContextStep } from "@/components/setup/context-step";
import { PageContainer, PageHeader } from "@/components/dashboard/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { PersonaStep } from "@/components/setup/persona-step";
import { FinalizeStep } from "@/components/setup/finalize-step";
import { SetupActions, SetupSummary } from "@/components/setup/setup-summary";
import { cn } from "@/lib/utils";
import {
  buildRoundScenarioDescription,
  buildRoundScenarioTitle,
  getCurrentRound,
} from "@/lib/interview-rounds";

type StepId = "context" | "rounds" | "persona" | "review";

type StepDefinition = {
  id: StepId;
  /** The word in the stepper. Each step's content carries its own headings. */
  label: string;
};

const STEPS: StepDefinition[] = [
  { id: "context", label: "Brief" },
  { id: "rounds", label: "Rounds" },
  { id: "persona", label: "Interviewer" },
  // What is left before you start. The review of your choices lives in the
  // summary panel beside every step, not on a step of its own.
  { id: "review", label: "Ready" },
];

const PAGE_DESCRIPTION =
  "Brief, rounds and interviewer, then a quick check and you are in the room.";

export default function SetupPage() {
  return (
    <Suspense fallback={<SetupLoadingFallback />}>
      <SetupWizard />
    </Suspense>
  );
}

/** The same frame as the page it stands in for, so nothing shifts on load. */
function SetupLoadingFallback() {
  return (
    <PageContainer>
      <PageHeader title="New interview" description={PAGE_DESCRIPTION} />
      <Skeleton className="h-8 w-80 max-w-full rounded-md" />
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Skeleton className="h-96 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </PageContainer>
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
    refresh: refreshPersonaLibrary,
  } = usePersonaLibrary();

  /**
   * The wizard's one job-description library, passed down to the picker.
   *
   * Deliberately a single instance. The picker used to mount its own, so the
   * page and the card held separate copies of the same mutable list: adding a
   * document updated the card's copy while the launch gate read the page's,
   * and creating a job description in the wizard disabled Continue on the
   * grounds that a row three seconds old was "no longer in your library". Two
   * owners of one list cannot be kept in sync after the fact, so there is one.
   */
  const jobDescriptions = useJobDescriptions();
  /**
   * The job description this wizard is currently pointing at, resolved against
   * the one library instance rather than trusted from the config.
   *
   * The config carries copies of `company` and `savedTitle` taken when it was
   * chosen, and those go stale the moment the document is renamed on the
   * library page. Everything downstream — the Rounds step's suggestion, the
   * launch snapshot, the gate below — reads the row instead.
   */
  const selectedJobDescription =
    setup.jobDescription.enabled && setup.jobDescription.savedId
      ? (jobDescriptions.items.find(
          (item) => item.id === setup.jobDescription.savedId,
        ) ?? null)
      : null;
  const jobDescriptionText = selectedJobDescription?.rawText ?? "";

  /**
   * The wizard's one resume library, on the same terms as the job-description one
   * above: mounted here and passed down, never a second instance in the picker.
   */
  const resumes = useResumes();
  const selectedResume =
    setup.resume.enabled && setup.resume.savedId
      ? (resumes.items.find((item) => item.id === setup.resume.savedId) ?? null)
      : null;
  /**
   * The setup as the Review step should describe it.
   *
   * Same substitution `launchInterview` makes, so what the user reads before
   * launching is what the session is actually created with. Reading the config's
   * `savedTitle` here meant Review asserted the old title while the session was
   * created with the new one.
   */
  const reviewSetup: InterviewSetupState = {
    ...setup,
    ...(selectedJobDescription
      ? {
          jobDescription: {
            ...setup.jobDescription,
            savedTitle: selectedJobDescription.title,
            company: selectedJobDescription.company ?? "",
            roleTitle: selectedJobDescription.roleTitle ?? "",
          },
        }
      : {}),
    ...(selectedResume
      ? { resume: { ...setup.resume, savedTitle: selectedResume.title } }
      : {}),
  };

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
      // The id stays. It used to be cleared here on every keystroke, which
      // meant "Update saved" — rendered only while an id is set *and* the
      // config is modified — could never appear: the first edit removed the
      // id that the button needed. Modified-ness is now a field comparison in
      // the step, and launch only attributes the session to this entry while
      // the config still equals it.
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
    const candidate = {
      ...setup.personaConfig,
      name: (name ?? setup.personaConfig.name).trim(),
    };
    // The server refuses a persona without its four identity fields. The step
    // disables the button on the same rule; this is the belt to that brace.
    if (!personaIdentityComplete(candidate)) return;
    const created = await createPersonaEntryAsync(candidate);
    if (!created) {
      toast.error("Could not save persona.");
      return;
    }
    setSetup((current) => ({
      ...current,
      personaConfig: created.config,
      personaLibraryId: created.id,
    }));
    toast.success(`Saved "${created.config.name}" to your library.`);
  };

  const handleUpdatePersonaInLibrary = async (entryId: string) => {
    const candidate = {
      ...setup.personaConfig,
      name: setup.personaConfig.name.trim(),
    };
    if (!personaIdentityComplete(candidate)) return;
    const updated = await updatePersonaEntryAsync(entryId, candidate);
    if (!updated) {
      toast.error("Could not update persona.");
      return;
    }
    setSetup((current) => ({
      ...current,
      personaConfig: updated.config,
      personaLibraryId: updated.id,
    }));
    toast.success("Persona updated.");
  };

  const handleDuplicatePersona = async (entryId: string) => {
    const original = personaLibrary.find((entry) => entry.id === entryId);
    if (!original) return;
    const copy = await duplicatePersonaEntryAsync(original);
    if (!copy) {
      toast.error("Could not duplicate persona.");
      return;
    }
    setSetup((current) => ({
      ...current,
      personaConfig: { ...copy.config },
      personaLibraryId: copy.id,
    }));
    toast.success(`Duplicated as "${copy.config.name}".`);
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
      void startInterview();
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
      /**
       * Read from the library row, not from the config's copy of it.
       *
       * `savedTitle` and `company` are snapshotted onto the config when a
       * document is chosen, and go stale the moment it is renamed on the
       * library page — leaving the session's `launch_meta`, the report header
       * and the interviewer's own briefing all naming an employer the user has
       * since corrected. The row is the source of truth; the config only
       * remembers which row.
       */
      const jobDescriptionTitle: string | null =
        selectedJobDescription?.title ?? setup.jobDescription.savedTitle;

      // Launch selects; it never creates. Both documents resolve through the
      // same rule — see `resolveLaunchAttachment`.
      const jd = resolveLaunchAttachment(
        "job description",
        setup.jobDescription,
        selectedJobDescription,
      );
      if ("error" in jd) throw new Error(jd.error);
      const jobDescriptionId = jd.id;

      /**
       * Read from the library row rather than the config's copy, exactly as the
       * job description is above — a resume renamed on the library page should
       * reach the session under its current name.
       */
      const resumeTitle: string | null =
        selectedResume?.title ?? setup.resume.savedTitle;

      const resume = resolveLaunchAttachment(
        "resume",
        setup.resume,
        selectedResume,
      );
      if ("error" in resume) throw new Error(resume.error);
      const resumeId = resume.id;

      /**
       * The setup as it should be recorded, with both documents' fields re-read
       * from their library rows.
       *
       * Every writer below takes this rather than `setup`. Refreshing only the
       * `launch_meta` call left `saveInterviewLaunch` — the sessionStorage
       * payload the interview screen actually boots from — spreading the config
       * copies, so a company renamed on the library page reached the server but
       * not the screen.
       */
      const refreshedSetup: InterviewSetupState = {
        ...setup,
        resume: {
          ...setup.resume,
          savedTitle: resumeTitle,
        },
        jobDescription: {
          ...setup.jobDescription,
          savedTitle: jobDescriptionTitle,
          company:
            selectedJobDescription?.company ?? setup.jobDescription.company,
          roleTitle:
            selectedJobDescription?.roleTitle ?? setup.jobDescription.roleTitle,
        },
      };

      /**
       * Retried once on a network failure. It creates a row, so a lost
       * *response* can leave an extra empty session behind — which is a far
       * cheaper outcome than a candidate stuck on "Failed to fetch" at the
       * moment they press Start interview.
       */
      const response = await fetchWithRetry("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          practiceMode: launchPracticeMode,
          scenarioValue: setup.scenarioValue,
          scenarioTitle,
          scenarioDescription,
          // Attributed to the library entry only while it still *is* that
          // entry. A tweaked-but-unsaved interviewer is its own persona; the
          // config below carries what actually ran.
          personaId: (() => {
            const active = personaLibrary.find(
              (entry) => entry.id === setup.personaLibraryId,
            );
            return active &&
              personaConfigEquals(setup.personaConfig, active.config)
              ? active.id
              : null;
          })(),
          jobDescriptionId,
          resumeId,
          personaConfig: setup.personaConfig,
          launchMeta: buildLaunchMetaFromSetup(refreshedSetup),
        }),
      });

      const { session } = await readJson<{ session: { id: string } }>(response);

      saveInterviewLaunch({
        ...refreshedSetup,
        practiceMode: launchPracticeMode,
        sessionId: session.id,
        jobDescription: {
          ...refreshedSetup.jobDescription,
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

  /**
   * Asks for the microphone and releases it straight away. Resolves to whether
   * it works, so Start interview can stop before the interviewer speaks.
   */
  const checkMicrophone = async (): Promise<boolean> => {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      setMicrophoneStatus("failed");
      setMicrophoneMessage(
        "Microphone API is not available in this environment.",
      );
      return false;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicrophoneStatus("failed");
      setMicrophoneMessage(
        "Your browser does not expose microphone APIs. Try a recent Chrome, Edge, or Safari over HTTPS.",
      );
      return false;
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
      return true;
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
      return false;
    }
  };

  /**
   * Start interview, for a voice interview, checks the microphone first.
   *
   * The check used to be its own button that had to be pressed before Start
   * would enable, which was a step to discover rather than a step to take. Now
   * pressing Start is the check. It runs again on every press until it passes
   * on this visit, because a permission granted last week can have been
   * revoked since. If it fails, nothing launches and the Ready step says why;
   * pressing Start again retries.
   */
  const startInterview = async () => {
    const launchesVoice =
      setup.practiceMode === "voice" ||
      (setup.interviewLoop.enabled &&
        getCurrentRound(setup.interviewLoop).practiceMode === "voice");
    if (launchesVoice && microphoneStatus !== "ready") {
      const works = await checkMicrophone();
      if (!works) return;
    }
    await launchInterview();
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
      // A job description is either chosen or it is not. `mode` is the picker's
      // own display state and says nothing about whether we can launch.
      if (setup.jobDescription.enabled) {
        if (!setup.jobDescription.savedId) {
          return "Choose or add a job description, or turn it off.";
        }
        /**
         * The chosen id must still resolve to a row.
         *
         * `savedId` is persisted in localStorage, so deleting that job
         * description from the library page leaves the wizard pointing at a row
         * that no longer exists. Without this the gate passed, and
         * `interview_sessions.job_description_id` references
         * `job_descriptions(id)` — so launching failed on a foreign-key
         * violation, which reaches the user as an opaque server error at the
         * one moment they are trying to start an interview.
         *
         * Only enforced once the library has loaded; while it is in flight the
         * absence means nothing.
         */
        if (jobDescriptions.status === "ready" && !selectedJobDescription) {
          return "That job description is no longer in your library. Choose another, or turn it off.";
        }
      }
      if (setup.resume.enabled) {
        if (!setup.resume.savedId) {
          return "Choose or add a resume, or turn it off.";
        }
        // Same reasoning as the job description above: a `savedId` from
        // localStorage can point at a resume deleted since, and without this the
        // gate passed and the session insert died on the foreign key.
        if (resumes.status === "ready" && !selectedResume) {
          return "That resume is no longer in your library. Choose another, or turn it off.";
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
    // No microphone gate here: Start interview checks the microphone itself
    // before it launches a voice interview. See `startInterview`.
    return null;
  })();

  return (
    // The shared page frame, like every /dashboard page: `AppShell`'s <main>
    // owns the scroll container and the page background.
    <PageContainer>
      {/* Named as the sidebar's button and every "New interview" action
          that leads here names it. */}
      <PageHeader title="New interview" description={PAGE_DESCRIPTION} />

      <Stepper currentStepId={currentStep} onStepSelect={goToStep} />

      {/* The step on the left, the interview it is building on the right.
          The panel holds the step buttons, so the way forward is always in
          the same place however long a step is; below `lg` it follows the
          step, where the buttons used to sit. */}
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {/* Keyed on the step so React remounts this subtree and the entrance
              animation replays; the direction makes the wizard read as one
              surface you move along rather than four unrelated screens. */}
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
                jobDescriptionLibrary={jobDescriptions}
                resumeLibrary={resumes}
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
                jobDescriptionText={jobDescriptionText}
                personaLibrary={personaLibrary}
                onChange={(interviewLoop) => updateSetup({ interviewLoop })}
              />
            )}

            {currentStep === "persona" && (
              <PersonaStep
                value={setup.personaConfig}
                activeLibraryId={setup.personaLibraryId}
                library={personaLibrary}
                status={personaLibraryStatus}
                error={personaLibraryError}
                onRetry={() => void refreshPersonaLibrary()}
                onPatch={updatePersona}
                onPick={handlePickPersona}
                onRandomize={handleRandomizePersona}
                onSaveAsNew={handleSavePersona}
                onUpdateLibraryEntry={handleUpdatePersonaInLibrary}
                onDuplicate={handleDuplicatePersona}
              />
            )}

            {currentStep === "review" && (
              <FinalizeStep
                setup={reviewSetup}
                onUpdate={updateSetup}
                onModeChange={updateMode}
                microphoneStatus={microphoneStatus}
                microphoneMessage={microphoneMessage}
              />
            )}
          </div>

          {(launchError || personaLibraryError) && (
            <div
              role="alert"
              className="rounded-lg border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-emphasis"
            >
              {launchError ?? personaLibraryError}
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-8">
          <SetupSummary
            setup={reviewSetup}
            microphoneStatus={microphoneStatus}
            stepLabel={STEPS[stepIndex].label}
            isFirstStep={isFirstStep}
            isLastStep={isLastStep}
            blockedReason={blockedReason}
            isLaunching={isLaunching}
            onBack={goBack}
            onNext={goNext}
          />
        </div>
      </div>

      {/* The wizard's actions, pinned above the bottom bar on phones. The
          summary card carries them from `lg`; below that it sits under the
          whole form, and Continue was a long scroll away. Sticky rather than
          fixed so it scrolls with `main` and settles into the flow at the end. */}
      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 -mx-6 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur lg:hidden">
        {blockedReason && (
          <p className="mb-2 text-xs leading-5 text-warning-emphasis" role="status">
            {blockedReason}
          </p>
        )}
        <SetupActions
          voice={reviewSetup.practiceMode === "voice"}
          isFirstStep={isFirstStep}
          isLastStep={isLastStep}
          canProceed={blockedReason === null}
          micChecking={microphoneStatus === "checking"}
          isLaunching={isLaunching}
          onBack={goBack}
          onNext={goNext}
          layout="bar"
        />
      </div>
    </PageContainer>
  );
}

/**
 * Where you are in the four steps, across the full width of the page.
 *
 * It was a compact line of four text buttons clustered at the left, which
 * lined up with nothing below it and read as a row of links rather than as
 * progress. Now each step is an equal column with a bar on top: blue for the
 * steps you have reached, grey for the ones ahead. The bar says how far along
 * you are at a glance, and the columns share the page's edges.
 *
 * The rules are unchanged: the current step is emphasised, steps you have
 * reached can be clicked to go back, and steps ahead cannot be jumped to.
 * Passing a step is navigation, not an achievement, so nothing turns green.
 */
function Stepper({
  currentStepId,
  onStepSelect,
}: {
  currentStepId: StepId;
  onStepSelect: (stepId: StepId) => void;
}) {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStepId);

  return (
    <ol className="grid grid-cols-4 gap-2 sm:gap-4" aria-label="Steps">
      {STEPS.map((step, index) => {
        const isActive = step.id === currentStepId;
        const isReached = index <= currentIndex;
        return (
          <li key={step.id} className="min-w-0">
            <button
              type="button"
              disabled={!isReached || isActive}
              aria-current={isActive ? "step" : undefined}
              onClick={() => onStepSelect(step.id)}
              className={cn(
                "group w-full rounded-md pb-1 text-left transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-muted",
                isReached && !isActive ? "cursor-pointer" : "cursor-default",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "block h-1 rounded-full transition-colors duration-300 ease-soft",
                  isReached ? "bg-primary" : "bg-slate-200",
                )}
              />
              <span
                className={cn(
                  "mt-2.5 flex min-w-0 items-baseline gap-2 text-sm",
                  isActive
                    ? "font-semibold text-slate-900"
                    : isReached
                      ? "font-medium text-slate-600 group-hover:text-slate-900"
                      : "font-medium text-slate-400",
                )}
              >
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    isActive ? "text-primary" : "text-slate-400",
                  )}
                >
                  {index + 1}
                </span>
                <span className="truncate">{step.label}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
