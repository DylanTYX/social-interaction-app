/**
 * Which accent an interviewer speaks with, derived from their nationality.
 *
 * The one rule this file exists to hold: **the accent is acoustic and TTS-only.**
 * It selects an Azure voice and nothing else. It never enters the interviewer's
 * prompt, never changes word choice, grammar or register, never produces written
 * dialect, and never reaches the analyzer. A persona with `nationality: "Indian"`
 * speaks the same English sentences as one with `"Swedish"` — the audio differs,
 * the transcript does not.
 *
 * That line is what keeps this compatible with `NATIONALITY_IS_BACKGROUND` and
 * requirement E1, which forbid nationality from driving interviewer *behaviour*
 * — how direct, formal, deferential or demanding they are. Those come from the
 * dials, and still do. See `docs/DESIGN-DECISIONS.md` §5. The proof is negative
 * and mechanical: `persona-engine.ts` does not import this module, and a test
 * asserts two personas differing only in nationality still produce prompts
 * differing by exactly the demonym.
 *
 * Deliberately imports only `speech-voices.ts`, so the setup wizard can call it
 * without pulling in the Azure SDK.
 */

import {
  ACCENT_VOICES,
  DEFAULT_VOICE_URI,
  resolveKnownVoice,
  type SpeechVoiceOption,
} from "@/lib/speech-voices";
// Type-only, so this does not create a runtime dependency on the prompt
// builder. The reverse import — persona-engine reaching for this module —
// is the one that must never exist.
import type { PersonaVoiceGender } from "@/lib/persona-engine";

export type VoiceResolutionSource = "nationality" | "default";

/** Why an accent was not applied. Drives the honest UI copy; null when one was. */
export type VoiceFallbackReason =
  | "accents-off"
  | "no-nationality"
  | "no-accent-for-nationality"
  | "not-yet-auditioned"
  | "no-voice-for-gender"
  | null;

export interface ResolvedVoice {
  /** Azure `speechSynthesisVoiceName`. Always a URI in the catalogue. */
  uri: string;
  locale: string;
  /** Human-readable voice label, for the setup screen. */
  label: string;
  source: VoiceResolutionSource;
  reason: VoiceFallbackReason;
}

/**
 * Fold a free-text nationality into a comparison key.
 *
 * The field is a plain `<Input>` in both persona editors, validated only as
 * non-empty and truncated to 200 characters, so this receives arbitrary text:
 * "  CHINESE ", "Français", "Chinese-American", an emoji, a sentence.
 */
export function normalizeNationality(raw: string | null | undefined): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Normalised nationality → voice locale.
 *
 * Demonyms and country names both appear as keys, because users type both.
 * Coverage is bought with a long key list rather than loose matching, and that
 * is the important decision in this file:
 *
 * **Matching is exact after normalisation. No substring, prefix or fuzzy
 * matching, ever.** Substring matching mis-assigns on real inputs — "niger" is
 * inside "nigerian", "ind" is inside both "indian" and "indonesian". Edit
 * distance is worse: "irish" is 3 from "indian", "iranian" is 2. The asymmetry
 * of harm decides it. Giving a Ghanaian interviewer a neutral voice is a
 * non-event and the user can see why. Giving them an Indian accent because of a
 * string-distance tie is the *system* asserting a national-origin inference it
 * has no basis for, which is the exact failure this feature is otherwise
 * careful to avoid.
 *
 * A nationality that is not a key falls back to neutral English, visibly.
 */
const NATIONALITY_LOCALES: Readonly<Record<string, string>> = {
  american: "en-US",
  america: "en-US",
  usa: "en-US",
  us: "en-US",
  "united states": "en-US",
  "united states of america": "en-US",

  british: "en-GB",
  britain: "en-GB",
  "great britain": "en-GB",
  uk: "en-GB",
  "united kingdom": "en-GB",
  english: "en-GB",
  england: "en-GB",
  scottish: "en-GB",
  scotland: "en-GB",
  welsh: "en-GB",
  wales: "en-GB",

  irish: "en-IE",
  ireland: "en-IE",
  indian: "en-IN",
  india: "en-IN",
  singaporean: "en-SG",
  singapore: "en-SG",
  australian: "en-AU",
  australia: "en-AU",
  aussie: "en-AU",
  canadian: "en-CA",
  canada: "en-CA",
  "new zealander": "en-NZ",
  "new zealand": "en-NZ",
  kiwi: "en-NZ",
  "south african": "en-ZA",
  "south africa": "en-ZA",
  nigerian: "en-NG",
  nigeria: "en-NG",
  kenyan: "en-KE",
  kenya: "en-KE",
  tanzanian: "en-TZ",
  tanzania: "en-TZ",
  filipino: "en-PH",
  filipina: "en-PH",
  philippine: "en-PH",
  philippines: "en-PH",
  "the philippines": "en-PH",
  "hong konger": "en-HK",
  "hong kong": "en-HK",
  hongkonger: "en-HK",

  chinese: "zh-CN",
  china: "zh-CN",
  prc: "zh-CN",
  "peoples republic of china": "zh-CN",
  korean: "ko-KR",
  korea: "ko-KR",
  "south korean": "ko-KR",
  "south korea": "ko-KR",
  swedish: "sv-SE",
  sweden: "sv-SE",
  spanish: "es-ES",
  spain: "es-ES",
  mexican: "es-MX",
  mexico: "es-MX",
  french: "fr-FR",
  france: "fr-FR",
  german: "de-DE",
  germany: "de-DE",
  italian: "it-IT",
  italy: "it-IT",
  brazilian: "pt-BR",
  brazil: "pt-BR",
  brasil: "pt-BR",
  danish: "da-DK",
  denmark: "da-DK",
  indonesian: "id-ID",
  indonesia: "id-ID",
};

/** The locale an accent would use, whether or not a usable voice exists for it. */
export function localeForNationality(
  nationality: string | null | undefined,
): string | null {
  return NATIONALITY_LOCALES[normalizeNationality(nationality)] ?? null;
}

/**
 * Choose among a locale's usable voices.
 *
 * Exported and taking the candidate list as an argument purely so it is
 * testable: every locale currently enabled has both a female and a male voice,
 * so the interesting branch — a stated gender the locale cannot satisfy — is
 * unreachable through `resolveVoiceForPersona` today. It becomes reachable the
 * moment one voice of a pair is rejected on a future audition, which is exactly
 * when nobody will be looking.
 */
export function pickVoiceFrom(
  candidates: readonly SpeechVoiceOption[],
  gender: PersonaVoiceGender | undefined,
): { voice: SpeechVoiceOption } | { fail: VoiceFallbackReason } {
  if (candidates.length === 0) return { fail: "not-yet-auditioned" };

  if (gender && gender !== "unspecified") {
    const match = candidates.find((voice) => voice.gender === gender);
    // A stated preference that cannot be honoured drops to neutral English
    // rather than to the opposite gender. This is reachable whenever a locale
    // is only half-verified — Danish passed on the female voice and not the
    // male — and hearing a woman's voice for a persona explicitly set to male
    // is a worse failure than losing the accent.
    return match ? { voice: match } : { fail: "no-voice-for-gender" };
  }

  // No stated preference: take the first, stable because ACCENT_VOICES is a
  // literal in a fixed order. Deliberately NOT inferred from the persona's
  // name — name→gender guessing is unreliable across exactly the international
  // name set this app generates, and would add a second
  // inference-from-biography seam beside the one the codebase spent a design
  // decision closing.
  return { voice: candidates[0] };
}

function pickVoice(
  locale: string,
  gender: PersonaVoiceGender | undefined,
): { voice: SpeechVoiceOption } | { fail: VoiceFallbackReason } {
  return pickVoiceFrom(
    ACCENT_VOICES.filter((voice) => voice.locale === locale && voice.verified),
    gender,
  );
}

function fallback(reason: VoiceFallbackReason): ResolvedVoice {
  const voice = resolveKnownVoice(DEFAULT_VOICE_URI);
  return {
    uri: voice.uri,
    locale: voice.locale,
    label: voice.name,
    source: "default",
    reason,
  };
}

/**
 * The voice an interviewer speaks with.
 *
 * Precedence is deliberately short: the persona decides, or the default does.
 * There is no per-session voice override — the setup wizard used to offer one
 * and it is gone, because a session-level choice silently flattened every
 * interviewer in a multi-round loop to the same voice. `accentsEnabled` is the
 * only escape hatch, and it is all-or-nothing on purpose.
 */
export function resolveVoiceForPersona(input: {
  nationality: string | null | undefined;
  voiceGender?: PersonaVoiceGender;
  /** Defaults to true. False → neutral English for every interviewer. */
  accentsEnabled?: boolean;
}): ResolvedVoice {
  if (input.accentsEnabled === false) return fallback("accents-off");

  const normalized = normalizeNationality(input.nationality);
  if (!normalized) return fallback("no-nationality");

  const locale = NATIONALITY_LOCALES[normalized];
  if (!locale) return fallback("no-accent-for-nationality");

  // Distinguished from "no mapping" so the setup screen can say which of the
  // several ways this can miss actually happened.
  const picked = pickVoice(locale, input.voiceGender);
  if ("fail" in picked) return fallback(picked.fail);

  return {
    uri: picked.voice.uri,
    locale: picked.voice.locale,
    label: picked.voice.name,
    source: "nationality",
    reason: null,
  };
}

/**
 * One sentence for the setup screen saying what the candidate will hear.
 *
 * Factual, not promotional: it states the voice and, when there is no accent,
 * why not. A user who is told "no accent voice for Swedish" understands the
 * product; one who is told nothing assumes it is broken.
 */
export function describeResolvedVoice(
  resolved: ResolvedVoice,
  personaName: string,
  nationality: string | null | undefined,
): string {
  const who = personaName.trim() || "The interviewer";
  const demonym = nationality?.trim() ?? "";
  // "a Indian accent" otherwise. Crude but right for demonyms, which is the
  // only thing this ever sees.
  const article = /^[aeiou]/i.test(demonym) ? "an" : "a";
  // Just the name for the neutral case: "neutral English (Aria)" reads better
  // than repeating a label that describes an accent we are not applying.
  const shortLabel = resolved.label.split("—")[0].trim();

  switch (resolved.reason) {
    case null:
      return `${who} will speak English with ${article} ${demonym} accent (${resolved.label}).`;
    case "accents-off":
      return `Accents are off — every interviewer uses neutral English (${shortLabel}).`;
    case "no-nationality":
      return `No nationality set, so ${who} uses neutral English (${shortLabel}).`;
    case "no-accent-for-nationality":
      return `No accent voice for "${demonym}" — ${who} uses neutral English (${shortLabel}).`;
    case "not-yet-auditioned":
      return `No usable ${demonym} accent voice — ${who} uses neutral English (${shortLabel}).`;
    case "no-voice-for-gender":
      return `No ${demonym} accent voice matches the chosen voice — ${who} uses neutral English (${shortLabel}).`;
  }
}

/**
 * The card-sized version of `describeResolvedVoice`.
 *
 * The full sentence — "Isabella Rodriguez will speak English with a Spanish
 * accent (Elvira — es-ES)" — belongs in the editor, where the reason for a
 * fallback is something you can act on. At 293px it was the longest line on
 * the card and said the name of a person whose name is two lines above it.
 * This is the same resolution reduced to what a card needs: which accent, and
 * which voice, or neither.
 */
export function describeVoiceBriefly(
  resolved: ResolvedVoice,
  nationality: string | null | undefined,
  voiceGender: PersonaVoiceGender | undefined,
): string {
  const genderLabel =
    voiceGender === "female"
      ? "Female"
      : voiceGender === "male"
        ? "Male"
        : null;

  if (resolved.reason === null) {
    const demonym = nationality?.trim() || "Accented";
    return genderLabel
      ? `${demonym} accent · ${genderLabel}`
      : `${demonym} accent`;
  }

  // Every fallback lands on the neutral default voice. Whether that default
  // honours the gender preference is the catalogue's business, not the
  // card's, so the card claims only what it knows.
  return "Neutral English";
}
