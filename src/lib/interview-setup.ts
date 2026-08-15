import { getPersonaConfig, type PersonaConfig } from "./persona-engine";
import {
  createDefaultInterviewLoop,
  normalizeInterviewLoop,
  type InterviewLoopConfig,
} from "./interview-rounds";

export type PracticeMode = "text" | "voice";

export interface VoiceSetupConfig {
  microphoneChecked: boolean;
  sttEnabled: boolean;
  ttsEnabled: boolean;
  selectedVoiceName: string;
  selectedVoiceUri: string;
}

export type JobDescriptionSetupMode = "paste" | "upload" | "saved";

/**
 * How a job description is attached to a session.
 *
 * There is one library. The wizard either picks a row from it or adds one to
 * it; it never holds a private copy, and a job description is never
 * session-only. Everything below follows from that.
 *
 * The fields used to mean three different things depending on `mode`, and the
 * three modes mixed two verbs — "paste" and "upload" both *created* a record
 * while "saved" *selected* one. Once `savedId` was set the mode was decorative,
 * which is how a job description picked from the library could end up rendering
 * as an uploaded PDF, complete with a Replace button, and launch cleanly.
 */
export interface JobDescriptionSetupConfig {
  enabled: boolean;
  /**
   * Which add-method the picker is showing. **UI state only** — nothing outside
   * the picker may branch on it, and launch does not read it.
   */
  mode: JobDescriptionSetupMode;
  roleTitle: string;
  /**
   * Employer. Carried through launch into the session snapshot, because the
   * interviewer is told it — a "why us?" question needs a "us".
   */
  company: string;
  sourceUrl: string;
  /**
   * An unsaved draft, meaningful only while composing a new job description.
   * Cleared the moment one is saved or selected — see `savedId`.
   */
  rawText: string;
  /**
   * The chosen `job_descriptions` row. **This is the only field that decides
   * which job description a session runs against**, and the only one launch
   * reads.
   */
  savedId: string | null;
  /** Friendly label shown in summaries. */
  savedTitle: string | null;
}

export type ResumeSetupMode = "paste" | "upload" | "saved";

export interface ResumeSetupConfig {
  enabled: boolean;
  /** Same semantics as the JD config: paste creates a record at launch. */
  mode: ResumeSetupMode;
  rawText: string;
  savedId: string | null;
  savedTitle: string | null;
}

export interface InterviewSetupState {
  scenarioValue: string;
  /**
   * Free-text brief when `scenarioValue` is `custom`. Stored on the session
   * row as `scenario_description` and used to steer the interviewer.
   */
  customScenarioBrief?: string;
  streamResponses: boolean;
  liveCoachingEnabled: boolean;
  personaConfig: PersonaConfig;
  /**
   * Optional id linking back to the persona library entry the user picked.
   * Persisted so the wizard can highlight the matching card on revisit even
   * when the embedded `personaConfig` has since been edited elsewhere.
   */
  personaLibraryId?: string;
  practiceMode: PracticeMode;
  interviewLoop: InterviewLoopConfig;
  voiceConfig: VoiceSetupConfig;
  jobDescription: JobDescriptionSetupConfig;
  resume: ResumeSetupConfig;
}

/**
 * The launch payload extends the saved setup with the Supabase session id
 * created at launch time. This is per-tab (sessionStorage) so opening a new
 * tab starts a fresh session.
 */
export interface InterviewLaunchPayload extends InterviewSetupState {
  sessionId: string;
}

/**
 * Storage strategy:
 *   - Persona prefs and the most recent setup are stored in localStorage so
 *     they persist across browser sessions. This is what the wizard reads on
 *     mount.
 *   - The "launch" payload (the snapshot the chat/voice page reads when
 *     starting a session) lives in sessionStorage, scoped to a single tab.
 *     This avoids the chat page silently picking up state from a stale tab
 *     when the user opens a new dashboard.
 */
const SETUP_STORAGE_KEY = "social-interaction-app.interviewSetup";
const LAUNCH_STORAGE_KEY = "social-interaction-app.interviewLaunch";

/** Storage migration: the original implementation kept setup in sessionStorage too. */
const LEGACY_SESSION_SETUP_KEY = "social-interaction-app.interviewSetup";

/** An Azure voice name is ~30 characters; this is generous headroom. */
const MAX_VOICE_FIELD_CHARS = 120;

function createDefaultVoiceConfig(): VoiceSetupConfig {
  return {
    microphoneChecked: false,
    sttEnabled: true,
    ttsEnabled: true,
    selectedVoiceName: "",
    selectedVoiceUri: "",
  };
}

function createDefaultJobDescriptionConfig(): JobDescriptionSetupConfig {
  return {
    enabled: false,
    mode: "paste",
    roleTitle: "",
    company: "",
    sourceUrl: "",
    rawText: "",
    savedId: null,
    savedTitle: null,
  };
}

export function createDefaultResumeConfig(): ResumeSetupConfig {
  return {
    enabled: false,
    mode: "paste",
    rawText: "",
    savedId: null,
    savedTitle: null,
  };
}

function normalizeResumeConfig(
  resume: Partial<ResumeSetupConfig> | undefined,
): ResumeSetupConfig {
  const defaults = createDefaultResumeConfig();

  const mode: ResumeSetupMode =
    resume?.mode === "upload" ||
    resume?.mode === "saved" ||
    resume?.mode === "paste"
      ? resume.mode
      : defaults.mode;

  return {
    enabled: Boolean(resume?.enabled),
    mode,
    rawText: resume?.rawText ?? defaults.rawText,
    savedId: resume?.savedId ?? defaults.savedId,
    savedTitle: resume?.savedTitle ?? defaults.savedTitle,
  };
}

export function normalizeVoiceConfig(
  voiceConfig: Partial<VoiceSetupConfig> | undefined,
): VoiceSetupConfig {
  const defaults = createDefaultVoiceConfig();

  return {
    microphoneChecked: Boolean(voiceConfig?.microphoneChecked),
    sttEnabled:
      voiceConfig?.sttEnabled === undefined
        ? defaults.sttEnabled
        : Boolean(voiceConfig.sttEnabled),
    ttsEnabled:
      voiceConfig?.ttsEnabled === undefined
        ? defaults.ttsEnabled
        : Boolean(voiceConfig.ttsEnabled),
    // Bounded and type-checked: these two reach the server via `launch_meta`
    // and are handed to the Azure SDK as a voice name. `sanitizeLaunchMeta`
    // used to cast the whole object through with `as`, so neither the types
    // nor the lengths were ever actually checked on the server side.
    selectedVoiceName:
      typeof voiceConfig?.selectedVoiceName === "string"
        ? voiceConfig.selectedVoiceName.slice(0, MAX_VOICE_FIELD_CHARS)
        : defaults.selectedVoiceName,
    selectedVoiceUri:
      typeof voiceConfig?.selectedVoiceUri === "string"
        ? voiceConfig.selectedVoiceUri.slice(0, MAX_VOICE_FIELD_CHARS)
        : defaults.selectedVoiceUri,
  };
}

function normalizeJobDescriptionConfig(
  jobDescription: Partial<JobDescriptionSetupConfig> | undefined,
): JobDescriptionSetupConfig {
  const defaults = createDefaultJobDescriptionConfig();

  const mode: JobDescriptionSetupMode =
    jobDescription?.mode === "upload" ||
    jobDescription?.mode === "saved" ||
    jobDescription?.mode === "paste"
      ? jobDescription.mode
      : defaults.mode;

  const savedId = jobDescription?.savedId ?? defaults.savedId;

  return {
    enabled: Boolean(jobDescription?.enabled),
    mode,
    roleTitle: jobDescription?.roleTitle ?? defaults.roleTitle,
    company: jobDescription?.company ?? defaults.company,
    sourceUrl: jobDescription?.sourceUrl ?? defaults.sourceUrl,
    /**
     * A chosen job description wins over a draft, always.
     *
     * These are the only two states that matter — composing something new, or
     * having picked one — and letting both hold a value is what allowed them to
     * disagree. A blob written by an older build can carry both (paste mode
     * stored the text, then launch set an id elsewhere), and `LoopStep` reads
     * `rawText` to decide whether it can suggest rounds, so a stale draft
     * sitting behind a selected job description would have it suggesting rounds
     * from the wrong document.
     */
    rawText: savedId ? "" : (jobDescription?.rawText ?? defaults.rawText),
    savedId,
    savedTitle: jobDescription?.savedTitle ?? defaults.savedTitle,
  };
}

function normalizeSetup(
  setup: Partial<InterviewSetupState> | null | undefined,
): InterviewSetupState {
  const baseConfig = getPersonaConfig("sarah chen");

  if (!baseConfig) {
    throw new Error("Default persona configuration is missing.");
  }

  const defaultSetup: InterviewSetupState = {
    scenarioValue: "custom",
    customScenarioBrief: "",
    streamResponses: true,
    liveCoachingEnabled: true,
    personaConfig: {
      ...baseConfig,
      name: "Adaptive Interviewer",
    },
    practiceMode: "text",
    interviewLoop: createDefaultInterviewLoop(),
    voiceConfig: createDefaultVoiceConfig(),
    jobDescription: createDefaultJobDescriptionConfig(),
    resume: createDefaultResumeConfig(),
  };

  if (!setup) {
    return defaultSetup;
  }

  return {
    ...defaultSetup,
    ...setup,
    personaConfig: setup.personaConfig ?? defaultSetup.personaConfig,
    personaLibraryId: setup.personaLibraryId,
    customScenarioBrief:
      typeof setup.customScenarioBrief === "string"
        ? setup.customScenarioBrief
        : defaultSetup.customScenarioBrief,
    liveCoachingEnabled:
      setup.liveCoachingEnabled === undefined
        ? defaultSetup.liveCoachingEnabled
        : Boolean(setup.liveCoachingEnabled),
    practiceMode: setup.practiceMode === "voice" ? "voice" : "text",
    interviewLoop: normalizeInterviewLoop(
      setup.interviewLoop,
      setup.practiceMode === "voice" ? "voice" : "text",
    ),
    voiceConfig: normalizeVoiceConfig(setup.voiceConfig),
    jobDescription: normalizeJobDescriptionConfig(setup.jobDescription),
    resume: normalizeResumeConfig(setup.resume),
  };
}

export function createDefaultInterviewSetup(): InterviewSetupState {
  return normalizeSetup(null);
}

function isStorageAvailable(storage: Storage | undefined): storage is Storage {
  return typeof storage !== "undefined" && storage !== null;
}

function getLocal(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function getSession(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

export function saveInterviewSetup(setup: InterviewSetupState): void {
  const local = getLocal();
  if (!isStorageAvailable(local)) return;
  try {
    local.setItem(SETUP_STORAGE_KEY, JSON.stringify(setup));
  } catch {
    // ignore — storage may be full or disabled
  }
}

/**
 * Update part of the stored setup, leaving the rest alone.
 *
 * The interview screens re-save the setup on every session so the wizard
 * reflects what you actually ran. They did that with `saveInterviewSetup`,
 * which replaces the whole blob — and because neither screen has the document
 * config to hand, both passed `DEFAULT_SETUP.jobDescription` and
 * `DEFAULT_SETUP.resume`. So finishing one interview turned your job
 * description and CV back **off**, and you re-attached them by hand before the
 * next one. Every session.
 *
 * A merge makes the omission harmless: a caller that does not mention a field
 * cannot destroy it.
 */
export function updateInterviewSetup(
  patch: Partial<InterviewSetupState>,
): void {
  const current = loadInterviewSetup() ?? createDefaultInterviewSetup();
  saveInterviewSetup({ ...current, ...patch });
}

export function loadInterviewSetup(): InterviewSetupState | null {
  const local = getLocal();
  if (!isStorageAvailable(local)) return null;

  let raw: string | null = null;
  try {
    raw = local.getItem(SETUP_STORAGE_KEY);
  } catch {
    raw = null;
  }

  // One-time migration from the previous sessionStorage location, so users
  // upgrading from an earlier build do not lose their last setup.
  if (!raw) {
    const session = getSession();
    if (isStorageAvailable(session)) {
      try {
        const legacy = session.getItem(LEGACY_SESSION_SETUP_KEY);
        if (legacy) {
          raw = legacy;
          try {
            local.setItem(SETUP_STORAGE_KEY, legacy);
          } catch {
            // ignore
          }
          try {
            session.removeItem(LEGACY_SESSION_SETUP_KEY);
          } catch {
            // ignore
          }
        }
      } catch {
        // ignore
      }
    }
  }

  if (!raw) return null;

  try {
    return normalizeSetup(JSON.parse(raw) as Partial<InterviewSetupState>);
  } catch {
    return null;
  }
}

/**
 * Where to send the user for a configured interview.
 *
 * `sessionId` matters: without it the URL does not identify the interview, so a
 * live session could not be linked, bookmarked, or reopened — and duplicating a
 * tab (which copies sessionStorage) gave two tabs the same session, both
 * writing one transcript. With it in the URL the interview screens load from
 * `/api/sessions/[id]/resume`, which is server-authoritative, and sessionStorage
 * becomes a cache rather than the source of truth.
 */
export function getSetupHref(
  setup: Partial<InterviewSetupState>,
  sessionId?: string,
): string {
  const params = new URLSearchParams();

  if (sessionId) {
    params.set("session", sessionId);
  }

  if (setup.practiceMode) {
    params.set("mode", setup.practiceMode);
  }

  if (setup.scenarioValue) {
    params.set("scenario", setup.scenarioValue);
  }

  if (setup.streamResponses !== undefined) {
    params.set("stream", setup.streamResponses ? "1" : "0");
  }

  const basePath =
    setup.practiceMode === "voice" ? "/simulate/voice" : "/simulate/chat";

  return `${basePath}?${params.toString()}`;
}

export function saveInterviewLaunch(payload: InterviewLaunchPayload): void {
  const session = getSession();
  if (!isStorageAvailable(session)) return;
  try {
    session.setItem(LAUNCH_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

export function loadInterviewLaunch(): InterviewLaunchPayload | null {
  const session = getSession();
  if (!isStorageAvailable(session)) return null;

  let raw: string | null = null;
  try {
    raw = session.getItem(LAUNCH_STORAGE_KEY);
  } catch {
    raw = null;
  }

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<InterviewLaunchPayload>;
    if (typeof parsed.sessionId !== "string" || !parsed.sessionId) {
      return null;
    }
    return {
      ...normalizeSetup(parsed),
      sessionId: parsed.sessionId,
    };
  } catch {
    return null;
  }
}
