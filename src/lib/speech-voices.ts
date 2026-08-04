/**
 * Curated set of voice options to surface in the setup wizard. These names are
 * valid `speechSynthesisVoiceName` values for Azure Neural TTS.
 *
 * This lives apart from `speechService.ts` on purpose. That module imports the
 * Azure Speech SDK at the top level, and the SDK drags in a Node-only
 * certificate-checking path (`async-disk-cache` → `istextorbinary` → …). The
 * setup wizard only needs this static list, so importing it from here keeps
 * the SDK — roughly a megabyte of browser-irrelevant code — out of the setup
 * page's bundle and out of the server-render graph entirely.
 */

export interface SpeechVoiceOption {
  name: string;
  uri: string;
}

export const AZURE_VOICE_OPTIONS: readonly SpeechVoiceOption[] = [
  { name: "Aria — US Female (warm)", uri: "en-US-AriaNeural" },
  { name: "Jenny — US Female (friendly)", uri: "en-US-JennyNeural" },
  { name: "Guy — US Male (confident)", uri: "en-US-GuyNeural" },
  { name: "Davis — US Male (calm)", uri: "en-US-DavisNeural" },
  { name: "Sonia — UK Female (clear)", uri: "en-GB-SoniaNeural" },
  { name: "Ryan — UK Male (steady)", uri: "en-GB-RyanNeural" },
] as const;
