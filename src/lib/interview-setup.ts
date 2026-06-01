import { getPersonaConfig, type PersonaConfig } from "./personaEngine";

export type PracticeMode = "text" | "voice";

export interface VoiceSetupConfig {
  microphoneChecked: boolean;
  sttEnabled: boolean;
  ttsEnabled: boolean;
  selectedVoiceName: string;
  selectedVoiceUri: string;
}

export interface InterviewSetupState {
  scenarioValue: string;
  streamResponses: boolean;
  personaConfig: PersonaConfig;
  practiceMode: PracticeMode;
  voiceConfig: VoiceSetupConfig;
}

const STORAGE_KEY = "social-interaction-app.interviewSetup";
const LAUNCH_KEY = "social-interaction-app.interviewLaunch";

function createDefaultVoiceConfig(): VoiceSetupConfig {
  return {
    microphoneChecked: false,
    sttEnabled: true,
    ttsEnabled: true,
    selectedVoiceName: "",
    selectedVoiceUri: "",
  };
}

function normalizeVoiceConfig(
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
    selectedVoiceName:
      voiceConfig?.selectedVoiceName ?? defaults.selectedVoiceName,
    selectedVoiceUri:
      voiceConfig?.selectedVoiceUri ?? defaults.selectedVoiceUri,
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
    scenarioValue: "qbr",
    streamResponses: true,
    personaConfig: {
      ...baseConfig,
      name: "Adaptive Interviewer",
    },
    practiceMode: "text",
    voiceConfig: createDefaultVoiceConfig(),
  };

  if (!setup) {
    return defaultSetup;
  }

  return {
    ...defaultSetup,
    ...setup,
    personaConfig: setup.personaConfig ?? defaultSetup.personaConfig,
    practiceMode: setup.practiceMode === "voice" ? "voice" : "text",
    voiceConfig: normalizeVoiceConfig(setup.voiceConfig),
  };
}

export function createDefaultInterviewSetup(): InterviewSetupState {
  return normalizeSetup(null);
}

export function saveInterviewSetup(setup: InterviewSetupState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(setup));
}

export function loadInterviewSetup(): InterviewSetupState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return normalizeSetup(JSON.parse(raw) as Partial<InterviewSetupState>);
  } catch {
    return null;
  }
}

export function getSetupHref(setup: Partial<InterviewSetupState>): string {
  const params = new URLSearchParams();

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

export function saveInterviewLaunch(setup: InterviewSetupState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(LAUNCH_KEY, JSON.stringify(setup));
}

export function loadInterviewLaunch(): InterviewSetupState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.sessionStorage.getItem(LAUNCH_KEY);
  if (!raw) {
    return null;
  }

  try {
    return normalizeSetup(JSON.parse(raw) as Partial<InterviewSetupState>);
  } catch {
    return null;
  }
}

export function clearInterviewLaunch(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(LAUNCH_KEY);
}
