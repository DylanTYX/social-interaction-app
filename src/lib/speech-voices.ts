/**
 * The voice catalogue: every Azure Neural TTS voice this app is allowed to use.
 *
 * This lives apart from `speechService.ts` on purpose. That module imports the
 * Azure Speech SDK at the top level, and the SDK drags in a Node-only
 * certificate-checking path (`async-disk-cache` → `istextorbinary` → …). The
 * setup wizard only needs this static data, so importing it from here keeps
 * the SDK — roughly a megabyte of browser-irrelevant code — out of the setup
 * page's bundle and out of the server-render graph entirely. Keep this file
 * free of SDK imports.
 *
 * Two lists, because they answer different questions:
 *
 *   - `ACCENT_VOICES` is what an interviewer *speaks with*, chosen from their
 *     nationality by `persona-voice.ts`. Not user-pickable — a 54-item dropdown
 *     is a worse picker than no picker.
 *   - `AZURE_VOICE_OPTIONS` is the legacy hand-picked six. Nothing selects from
 *     it any more (see `finalize-step.tsx`), but sessions launched before
 *     accents shipped carry one of these URIs in `launch_meta`, so the names
 *     still have to resolve.
 *
 * Every entry was checked against the live catalogue for the configured region
 * and is recorded in `docs/artifacts/azure-voices-southeastasia.json`. All are
 * `Status: GA` with no secondary locales — deliberately, see `verified` below.
 */

export type VoiceGender = "female" | "male";

export interface SpeechVoiceOption {
  /** Human-readable label, shown in the UI. */
  name: string;
  /** Azure `speechSynthesisVoiceName`. */
  uri: string;
  /**
   * BCP-47 locale of the voice itself.
   *
   * Stored rather than parsed off the front of `uri`. Splitting on the second
   * hyphen happens to work for all 60 entries here, but this value decides the
   * SSML `xml:lang` attribute, and a locale that is silently wrong there
   * produces mispronounced English rather than an error.
   */
  locale: string;
  gender: VoiceGender;
}

/**
 * The voice used when nothing else resolves: unknown nationality, an accent
 * that has not been auditioned, accents switched off, or a stale voice URI
 * read back out of an old session's `launch_meta`.
 */
export const DEFAULT_VOICE_URI = "en-US-AriaNeural";

/**
 * Legacy: the six voices the setup wizard used to offer as a dropdown.
 *
 * Retained only so a URI stored in an older session still resolves through
 * `isKnownVoiceUri`. All six also appear in `ACCENT_VOICES`.
 */
export const AZURE_VOICE_OPTIONS: readonly SpeechVoiceOption[] = [
  { name: "Aria — US Female (warm)", uri: "en-US-AriaNeural", locale: "en-US", gender: "female" },
  { name: "Jenny — US Female (friendly)", uri: "en-US-JennyNeural", locale: "en-US", gender: "female" },
  { name: "Guy — US Male (confident)", uri: "en-US-GuyNeural", locale: "en-US", gender: "male" },
  { name: "Davis — US Male (calm)", uri: "en-US-DavisNeural", locale: "en-US", gender: "male" },
  { name: "Sonia — UK Female (clear)", uri: "en-GB-SoniaNeural", locale: "en-GB", gender: "female" },
  { name: "Ryan — UK Male (steady)", uri: "en-GB-RyanNeural", locale: "en-GB", gender: "male" },
] as const;

export interface AccentVoice extends SpeechVoiceOption {
  /**
   * Whether a human has listened to this voice reading English and confirmed
   * it produces intelligible, recognisably accented English.
   *
   * This is the load-bearing field, and it exists because of an asymmetry in
   * the catalogue. Fourteen `en-XX` locales are real English voices with
   * genuine regional accents — there is nothing to check. The rest are not:
   * Azure has no `en-CN`, `en-JP`, `en-SE` or `en-ES`, so a Chinese or Swedish
   * accent means pointing a `zh-CN` or `sv-SE` voice at English text, and
   * whether that yields an accent or mangled Latin script is not knowable from
   * the documentation. An unverified entry never resolves; it falls back to
   * `DEFAULT_VOICE_URI`, and `persona-voice.test.ts` enforces that.
   *
   * Flipped one locale at a time from the audition sheet. Regenerate with
   * `npm run eval:voices -- --live --stt`.
   */
  verified: boolean;
  /** ISO date of the audition run that set `verified`, or null. */
  verifiedOn: string | null;
  /** Azure region the audition ran in. A verdict from another region is not evidence for this one. */
  region: string | null;
  /** What was actually heard. One line. */
  note: string;
}

/**
 * Voices that can carry an accent, one female and one male per locale.
 *
 * Only plain neural voices are listed. Azure's `*MultilingualNeural` and
 * `*:DragonHDLatestNeural` variants are excluded on purpose: they advertise
 * 100+ secondary locales and are engineered to sound *near-native* in each,
 * which would silently defeat this entire feature — a `zh-CN` multilingual
 * voice reading English sounds American. `persona-voice.test.ts` asserts none
 * of them creep back in.
 */
/**
 * Why the three rejected locales are rejected, written once.
 *
 * The failure is not "a strong accent". A monolingual voice has a
 * grapheme-to-phoneme front end built for one orthography, so English text is
 * mapped through that language's letter values into its phoneme inventory and
 * re-syllabified to fit its phonotactics. The output is the right words rebuilt
 * out of the wrong sound system — which is a different thing from a speaker of
 * that language having an accent in English, and is not what this feature is
 * for.
 *
 * Nothing better exists in the catalogue: every plain voice in these locales
 * advertises zero secondary locales, and the only alternatives are the
 * `Multilingual`/`DragonHD` variants, which are built to sound *native* in
 * English and would leave the feature wired up but inaudible.
 */
const NOT_AN_ACCENT =
  "Rejected on listening: renders English through the voice's own phonotactics " +
  "rather than accenting it. Not a strong accent — the words are rebuilt from " +
  "the wrong sound system. No better voice exists in this locale";

export const ACCENT_VOICES: readonly AccentVoice[] = [
  // ---------------------------------------------------------------------
  // Real English locales. Native English voices with regional accents, so
  // there is no hypothesis to test — the accent is what the voice *is*.
  // ---------------------------------------------------------------------
  v("Aria — American", "en-US-AriaNeural", "en-US", "female"),
  v("Guy — American", "en-US-GuyNeural", "en-US", "male"),
  v("Sonia — British", "en-GB-SoniaNeural", "en-GB", "female"),
  v("Ryan — British", "en-GB-RyanNeural", "en-GB", "male"),
  v("Neerja — Indian", "en-IN-NeerjaNeural", "en-IN", "female"),
  v("Prabhat — Indian", "en-IN-PrabhatNeural", "en-IN", "male"),
  v("Luna — Singaporean", "en-SG-LunaNeural", "en-SG", "female"),
  v("Wayne — Singaporean", "en-SG-WayneNeural", "en-SG", "male"),
  v("Natasha — Australian", "en-AU-NatashaNeural", "en-AU", "female"),
  v("William — Australian", "en-AU-WilliamNeural", "en-AU", "male"),
  v("Clara — Canadian", "en-CA-ClaraNeural", "en-CA", "female"),
  v("Liam — Canadian", "en-CA-LiamNeural", "en-CA", "male"),
  v("Emily — Irish", "en-IE-EmilyNeural", "en-IE", "female"),
  v("Connor — Irish", "en-IE-ConnorNeural", "en-IE", "male"),
  v("Molly — New Zealander", "en-NZ-MollyNeural", "en-NZ", "female"),
  v("Mitchell — New Zealander", "en-NZ-MitchellNeural", "en-NZ", "male"),
  v("Leah — South African", "en-ZA-LeahNeural", "en-ZA", "female"),
  v("Luke — South African", "en-ZA-LukeNeural", "en-ZA", "male"),
  v("Ezinne — Nigerian", "en-NG-EzinneNeural", "en-NG", "female"),
  v("Abeo — Nigerian", "en-NG-AbeoNeural", "en-NG", "male"),
  v("Asilia — Kenyan", "en-KE-AsiliaNeural", "en-KE", "female"),
  v("Chilemba — Kenyan", "en-KE-ChilembaNeural", "en-KE", "male"),
  v("Imani — Tanzanian", "en-TZ-ImaniNeural", "en-TZ", "female"),
  v("Elimu — Tanzanian", "en-TZ-ElimuNeural", "en-TZ", "male"),
  v("Rosa — Filipino", "en-PH-RosaNeural", "en-PH", "female"),
  v("James — Filipino", "en-PH-JamesNeural", "en-PH", "male"),
  v("Yan — Hong Konger", "en-HK-YanNeural", "en-HK", "female"),
  v("Sam — Hong Konger", "en-HK-SamNeural", "en-HK", "male"),

  // ---------------------------------------------------------------------
  // Native-locale voices reading English — the only route to a Chinese,
  // Swedish (etc.) accent, since Azure has no `en-CN` or `en-SE`. Every one
  // was synthesised and listened to on 2026-08-23; `a()` passed, `r()` did
  // not. Rejected rows stay here on purpose. Method and clips:
  // `docs/artifacts/voice-audition.md`.
  // ---------------------------------------------------------------------
  a("Xiaoxiao — Chinese", "zh-CN-XiaoxiaoNeural", "zh-CN", "female", "3%"),
  a("Yunxi — Chinese", "zh-CN-YunxiNeural", "zh-CN", "male", "3%"),
  r("Nanami — Japanese", "ja-JP-NanamiNeural", "ja-JP", "female",
    `${NOT_AN_ACCENT}; 2 of 7 plain ja-JP voices sampled. WER 29%.`),
  r("Keita — Japanese", "ja-JP-KeitaNeural", "ja-JP", "male",
    `${NOT_AN_ACCENT}; 2 of 7 plain ja-JP voices sampled. WER 50%.`),
  a("Sun-Hi — Korean", "ko-KR-SunHiNeural", "ko-KR", "female", "38%"),
  a("In-Joon — Korean", "ko-KR-InJoonNeural", "ko-KR", "male", "38%"),
  a("Sofie — Swedish", "sv-SE-SofieNeural", "sv-SE", "female", "0%"),
  a("Mattias — Swedish", "sv-SE-MattiasNeural", "sv-SE", "male", "0%"),
  a("Elvira — Spanish", "es-ES-ElviraNeural", "es-ES", "female", "9%"),
  a("Álvaro — Spanish", "es-ES-AlvaroNeural", "es-ES", "male", "6%"),
  a("Dalia — Mexican", "es-MX-DaliaNeural", "es-MX", "female", "0%"),
  a("Jorge — Mexican", "es-MX-JorgeNeural", "es-MX", "male", "3%"),
  a("Denise — French", "fr-FR-DeniseNeural", "fr-FR", "female", "12%"),
  a("Henri — French", "fr-FR-HenriNeural", "fr-FR", "male", "9%"),
  a("Katja — German", "de-DE-KatjaNeural", "de-DE", "female", "0%"),
  a("Conrad — German", "de-DE-ConradNeural", "de-DE", "male", "3%"),
  a("Elsa — Italian", "it-IT-ElsaNeural", "it-IT", "female", "0%"),
  a("Diego — Italian", "it-IT-DiegoNeural", "it-IT", "male", "0%"),
  r("Francisca — Brazilian", "pt-BR-FranciscaNeural", "pt-BR", "female",
    `${NOT_AN_ACCENT}; 2 of 16 plain pt-BR voices sampled. WER 71%.`),
  r("Antônio — Brazilian", "pt-BR-AntonioNeural", "pt-BR", "male",
    `${NOT_AN_ACCENT}; 2 of 16 plain pt-BR voices sampled. WER 56%.`),
  r("Hoai My — Vietnamese", "vi-VN-HoaiMyNeural", "vi-VN", "female",
    `${NOT_AN_ACCENT}; both available vi-VN voices sampled. WER 65%.`),
  r("Nam Minh — Vietnamese", "vi-VN-NamMinhNeural", "vi-VN", "male",
    `${NOT_AN_ACCENT}; both available vi-VN voices sampled. WER 65%.`),
  a("Christel — Danish", "da-DK-ChristelNeural", "da-DK", "female", "0%"),
  a("Jeppe — Danish", "da-DK-JeppeNeural", "da-DK", "male", "21%"),
  a("Gadis — Indonesian", "id-ID-GadisNeural", "id-ID", "female", "26%"),
  a("Ardi — Indonesian", "id-ID-ArdiNeural", "id-ID", "male", "24%"),
];

/** A native English voice: verified by construction, since the accent is the voice. */
function v(
  name: string,
  uri: string,
  locale: string,
  gender: VoiceGender,
): AccentVoice {
  return {
    name,
    uri,
    locale,
    gender,
    verified: true,
    verifiedOn: "2026-08-23",
    region: "southeastasia",
    note: "Native English locale; regional accent is intrinsic to the voice. Catalogue-checked, not individually auditioned.",
  };
}

/**
 * A native-locale voice pointed at English text, **accepted** on listening.
 *
 * `wer` is what Azure's own `en-US` recogniser scored the clip and is recorded
 * for traceability, not as the reason for the verdict — several of these were
 * accepted despite a poor WER, because a recogniser fails on speech a person
 * follows without effort. The ear decided; the number is provenance.
 */
function a(
  name: string,
  uri: string,
  locale: string,
  gender: VoiceGender,
  wer: string,
): AccentVoice {
  return {
    name,
    uri,
    locale,
    gender,
    verified: true,
    verifiedOn: "2026-08-23",
    region: "southeastasia",
    note: `Auditioned by ear and accepted: accented English, followable. Recogniser WER ${wer}.`,
  };
}

/**
 * A native-locale voice pointed at English text, **rejected** on listening.
 *
 * Kept in the table rather than deleted. A row recording that a mapping was
 * tried and found wanting is evidence; a missing row is a gap. `verified:
 * false` means it can never resolve — the persona falls back to neutral
 * English and the setup screen says so.
 */
function r(
  name: string,
  uri: string,
  locale: string,
  gender: VoiceGender,
  note: string,
): AccentVoice {
  return {
    name,
    uri,
    locale,
    gender,
    verified: false,
    verifiedOn: "2026-08-23",
    region: "southeastasia",
    note,
  };
}


/**
 * Legacy first, accents second: a Map keeps the last write, so the six voices
 * that appear in both lists resolve to their accent-table label. Otherwise the
 * same URI carried two different names depending on whether it was reached by
 * nationality or by fallback — `en-US-AriaNeural` was both "Aria — American"
 * and "Aria — US Female (warm)".
 */
const BY_URI: ReadonlyMap<string, SpeechVoiceOption> = new Map(
  [...AZURE_VOICE_OPTIONS, ...ACCENT_VOICES].map((voice) => [voice.uri, voice]),
);

export function findVoiceByUri(uri: string | null | undefined): SpeechVoiceOption | null {
  return (uri && BY_URI.get(uri)) || null;
}

export function isKnownVoiceUri(uri: string | null | undefined): boolean {
  return findVoiceByUri(uri) !== null;
}

/**
 * Coerce an arbitrary voice URI to one this app actually knows.
 *
 * The security half of the accent work. `normalizeVoiceConfig` only type-checks
 * `selectedVoiceUri` and truncates it to 120 characters — it was never compared
 * against any list — and the value reaches both `speechSynthesisVoiceName` and,
 * unescaped, the SSML `<voice name="…">` attribute. A crafted `launch_meta`
 * could therefore close that attribute and inject elements. Resolving through
 * the catalogue means an unrecognised URI degrades to the default voice instead.
 */
export function resolveKnownVoiceUri(uri: string | null | undefined): string {
  return findVoiceByUri(uri)?.uri ?? DEFAULT_VOICE_URI;
}

/** The known voice for a URI, always non-null; falls back to the default voice. */
export function resolveKnownVoice(uri: string | null | undefined): SpeechVoiceOption {
  return findVoiceByUri(uri) ?? findVoiceByUri(DEFAULT_VOICE_URI)!;
}

/**
 * The language to declare on the SSML `<speak>` element.
 *
 * Not the same thing as the voice's locale, and the difference matters. The
 * interviewer always speaks English; only the accent varies. For an `en-*`
 * voice the two coincide. For a native-locale voice producing an accent they
 * must not: `xml:lang="zh-CN"` over English text tells Azure to apply Chinese
 * pronunciation rules to Latin script, which is a different and much worse
 * thing than a Chinese accent.
 *
 * This was previously hardcoded to `en-US` inside `buildProsodySsml`, which was
 * right for the content language and wrong for the six `en-GB` cases.
 */
export function ssmlLangForVoice(voiceLocale: string): string {
  return voiceLocale.startsWith("en-") ? voiceLocale : "en-US";
}
