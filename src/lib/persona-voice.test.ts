import { describe, expect, it } from "vitest";

/**
 * Nationality → accent, and the guarantees that keep it defensible.
 *
 * Three of these are not happy-path coverage but load-bearing invariants, and
 * each exists because the failure it prevents is silent:
 *
 *   - An unverified voice must never reach a user. Azure has no `en-CN`, so a
 *     Chinese accent means a `zh-CN` voice reading English, which can come out
 *     mangled. The `verified` flag gates that, and only a test makes the flag
 *     mean anything.
 *   - Azure's `*Multilingual*` voices sound near-native in English. One of
 *     those in the accent table would leave the feature looking wired up while
 *     doing nothing at all.
 *   - The randomiser can emit a nationality the table has never heard of. That
 *     should fail here, not fall back in production.
 *
 * The fourth is the ethical boundary: nationality selects a voice and nothing
 * else. `docs/DESIGN-DECISIONS.md` §5.
 */

import { readFileSync } from "node:fs";
import {
  ACCENT_VOICES,
  DEFAULT_VOICE_URI,
  isKnownVoiceUri,
  ssmlLangForVoice,
} from "@/lib/speech-voices";
import {
  describeResolvedVoice,
  localeForNationality,
  normalizeNationality,
  pickVoiceFrom,
  resolveVoiceForPersona,
  describeVoiceBriefly,
  type ResolvedVoice,
} from "@/lib/persona-voice";
import { NATIONALITY_POOL } from "@/lib/persona-library";
import { generatePersonaPrompt, PRESET_PERSONAS } from "@/lib/persona-engine";

const ALL_NATIONALITIES = [
  ...NATIONALITY_POOL,
  ...Object.values(PRESET_PERSONAS).map((persona) => persona.nationality),
];

describe("normalizeNationality", () => {
  it.each([
    ["Chinese", "chinese"],
    ["  CHINESE  ", "chinese"],
    ["chinese", "chinese"],
    ["Français", "francais"],
    ["Chinese-American", "chinese american"],
    ["New   Zealander", "new zealander"],
    ["U.S.A.", "u s a"],
    ["", ""],
  ])("folds %j to %j", (input, expected) => {
    expect(normalizeNationality(input)).toBe(expected);
  });

  it("survives the junk a free-text field actually receives", () => {
    // Both editors render nationality as a plain <Input>, validated only as
    // non-empty and truncated to 200 chars.
    expect(normalizeNationality(null)).toBe("");
    expect(normalizeNationality(undefined)).toBe("");
    expect(normalizeNationality("🇸🇬")).toBe("");
    expect(normalizeNationality("x".repeat(200))).toHaveLength(200);
  });
});

describe("every nationality the app can produce resolves", () => {
  // The sync test. Adding a 21st nationality to NATIONALITY_POOL without a
  // table entry should fail here rather than silently falling back in
  // production, which is the whole reason that pool is exported.
  it.each(ALL_NATIONALITIES)("%s resolves to a known voice", (nationality) => {
    const resolved = resolveVoiceForPersona({ nationality });
    expect(isKnownVoiceUri(resolved.uri)).toBe(true);
  });

  it.each(ALL_NATIONALITIES)("%s maps to a locale", (nationality) => {
    // Weaker than "has a usable voice" on purpose: an unauditioned locale is
    // still mapped, it just does not resolve yet.
    expect(localeForNationality(nationality)).not.toBeNull();
  });
});

describe("an unverified accent never reaches a user", () => {
  it("falls back to neutral English, and says which case it is", () => {
    const unverified = ACCENT_VOICES.filter((voice) => !voice.verified);
    expect(
      unverified.length,
      "no unverified voices left — delete this test or the flag",
    ).toBeGreaterThan(0);

    for (const voice of unverified) {
      const nationality = ALL_NATIONALITIES.find(
        (candidate) => localeForNationality(candidate) === voice.locale,
      );
      if (!nationality) continue;
      const resolved = resolveVoiceForPersona({ nationality });
      expect(resolved.uri).toBe(DEFAULT_VOICE_URI);
      expect(resolved.source).toBe("default");
      expect(resolved.reason).toBe("not-yet-auditioned");
    }
  });

  it("distinguishes a rejected accent from a nationality it never knew", () => {
    // These read identically to the user unless the copy separates them, and
    // they mean very different things: one was tried and found not to be an
    // accent at all, the other is a nationality the table has never heard of.
    expect(resolveVoiceForPersona({ nationality: "Japanese" }).reason).toBe(
      "not-yet-auditioned",
    );
    expect(resolveVoiceForPersona({ nationality: "Martian" }).reason).toBe(
      "no-accent-for-nationality",
    );
    expect(resolveVoiceForPersona({ nationality: "" }).reason).toBe(
      "no-nationality",
    );
    expect(
      resolveVoiceForPersona({ nationality: "Indian", accentsEnabled: false })
        .reason,
    ).toBe("accents-off");
  });
});

describe("a stated voice gender that cannot be honoured", () => {
  const female = {
    name: "F",
    uri: "xx-XX-FNeural",
    locale: "xx-XX",
    gender: "female" as const,
  };
  const male = {
    name: "M",
    uri: "xx-XX-MNeural",
    locale: "xx-XX",
    gender: "male" as const,
  };

  it("falls back to neutral English rather than the other gender", () => {
    // Hearing a woman's voice for a persona explicitly set to male is a worse
    // failure than losing the accent. This used to fall through to the first
    // candidate, which would have shipped silently: it is unreachable while
    // every enabled locale has both genders, and becomes reachable the moment
    // one voice of a pair is rejected on a later audition.
    expect(pickVoiceFrom([female], "male")).toEqual({
      fail: "no-voice-for-gender",
    });
    expect(pickVoiceFrom([male], "female")).toEqual({
      fail: "no-voice-for-gender",
    });
  });

  it("still honours a preference the locale can satisfy", () => {
    expect(pickVoiceFrom([female, male], "male")).toEqual({ voice: male });
    expect(pickVoiceFrom([female, male], "female")).toEqual({ voice: female });
  });

  it("takes the first voice when no preference is stated", () => {
    expect(pickVoiceFrom([female, male], "unspecified")).toEqual({
      voice: female,
    });
    expect(pickVoiceFrom([female, male], undefined)).toEqual({ voice: female });
  });

  it("reports an empty locale as unauditioned, not as a gender miss", () => {
    expect(pickVoiceFrom([], "male")).toEqual({ fail: "not-yet-auditioned" });
  });

  it("says so in the copy rather than silently swapping", () => {
    expect(
      describeResolvedVoice(
        {
          uri: DEFAULT_VOICE_URI,
          locale: "en-US",
          label: "Aria — American",
          source: "default",
          reason: "no-voice-for-gender",
        },
        "Lars",
        "Swedish",
      ),
    ).toContain("neutral English");
  });
});

describe("the accent table is internally consistent", () => {
  it("never lists a Multilingual voice", () => {
    // These advertise 100+ secondary locales and are engineered to sound
    // near-native in each, so a zh-CN one reading English sounds American.
    for (const voice of ACCENT_VOICES) {
      expect(voice.uri).not.toMatch(/Multilingual|DragonHD/i);
    }
  });

  it("declares a locale that matches its own URI", () => {
    for (const voice of ACCENT_VOICES) {
      expect(voice.uri.startsWith(`${voice.locale}-`)).toBe(true);
      expect(voice.locale).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    }
  });

  it("cites a voice the region actually offers", () => {
    // Offline, but it proves the citation resolves: a typo, or a voice Azure
    // retires from this region, fails here rather than at synthesis time.
    const catalogue = JSON.parse(
      readFileSync("docs/artifacts/azure-voices-southeastasia.json", "utf8"),
    ) as { voices: Array<{ ShortName: string; Status: string }> };
    const known = new Map(catalogue.voices.map((v) => [v.ShortName, v]));
    for (const voice of ACCENT_VOICES) {
      expect(
        known.get(voice.uri)?.Status,
        `${voice.uri} not in catalogue`,
      ).toBe("GA");
    }
  });

  it("records provenance for a rejection too, not just an acceptance", () => {
    // A rejected mapping stays in the table as evidence it was tried. Without
    // a date, a region and a reason it is indistinguishable from one nobody
    // has got to yet.
    const rejected = ACCENT_VOICES.filter((v) => !v.verified);
    expect(rejected.length).toBeGreaterThan(0);
    for (const voice of rejected) {
      expect(voice.verifiedOn, `${voice.uri} rejected with no date`).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      );
      expect(voice.region, `${voice.uri} rejected with no region`).toBeTruthy();
      expect(voice.note, `${voice.uri} rejected with no reason`).toMatch(
        /Rejected on listening/,
      );
    }
  });

  it("records provenance for everything it claims is verified", () => {
    for (const voice of ACCENT_VOICES.filter((v) => v.verified)) {
      expect(voice.verifiedOn, `${voice.uri} verified with no date`).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      );
      expect(voice.region, `${voice.uri} verified with no region`).toBeTruthy();
      expect(voice.note.length).toBeGreaterThan(0);
    }
  });
});

describe("resolution", () => {
  it("gives the same voice however the nationality was typed", () => {
    const forms = ["British", "british", "  BRITISH ", "Britain", "UK"];
    const uris = new Set(
      forms.map((f) => resolveVoiceForPersona({ nationality: f }).uri),
    );
    expect(uris.size).toBe(1);
  });

  it("actually differentiates — the feature's whole claim", () => {
    const british = resolveVoiceForPersona({ nationality: "British" });
    const indian = resolveVoiceForPersona({ nationality: "Indian" });
    const singaporean = resolveVoiceForPersona({ nationality: "Singaporean" });
    expect(new Set([british.uri, indian.uri, singaporean.uri]).size).toBe(3);
    expect(british.source).toBe("nationality");
  });

  it("honours the stated voice gender, and is stable without one", () => {
    expect(
      resolveVoiceForPersona({ nationality: "Indian", voiceGender: "male" })
        .uri,
    ).toBe("en-IN-PrabhatNeural");
    expect(
      resolveVoiceForPersona({ nationality: "Indian", voiceGender: "female" })
        .uri,
    ).toBe("en-IN-NeerjaNeural");
    // No preference must be deterministic — a voice that changed between
    // rounds of the same loop would read as a different interviewer.
    const a = resolveVoiceForPersona({ nationality: "Indian" }).uri;
    const b = resolveVoiceForPersona({
      nationality: "Indian",
      voiceGender: "unspecified",
    }).uri;
    expect(a).toBe(b);
  });

  it("does not match on substrings, however tempting", () => {
    // "niger" is inside "nigerian"; "ind" is inside both "indian" and
    // "indonesian". A loose matcher would assign a national-origin accent on a
    // coincidence, which is the one failure mode this feature cannot have.
    expect(resolveVoiceForPersona({ nationality: "Niger" }).source).toBe(
      "default",
    );
    expect(resolveVoiceForPersona({ nationality: "Ind" }).source).toBe(
      "default",
    );
    expect(resolveVoiceForPersona({ nationality: "Irish" }).uri).not.toBe(
      resolveVoiceForPersona({ nationality: "Indian" }).uri,
    );
  });
});

describe("ssmlLangForVoice", () => {
  it("declares the content language, not the voice's locale", () => {
    // The interviewer always speaks English. Declaring xml:lang="zh-CN" over
    // English text asks Azure to apply Chinese pronunciation to Latin script,
    // which is a different and much worse thing than a Chinese accent.
    expect(ssmlLangForVoice("en-GB")).toBe("en-GB");
    expect(ssmlLangForVoice("en-IN")).toBe("en-IN");
    expect(ssmlLangForVoice("zh-CN")).toBe("en-US");
    expect(ssmlLangForVoice("sv-SE")).toBe("en-US");
  });
});

describe("the accent is acoustic only", () => {
  it("keeps nationality out of the interviewer's prompt", () => {
    // Belt and braces on the boundary in DESIGN-DECISIONS §5, placed in the
    // module most likely to tempt someone into "just mention the accent".
    // The real guarantee is structural: persona-engine.ts does not import
    // persona-voice.ts, and persona-engine.test.ts pins the demonym claim.
    const prompt = generatePersonaPrompt({
      ...PRESET_PERSONAS["sarah chen"],
      voiceGender: "female",
    });
    expect(prompt).not.toMatch(/accent/i);
    expect(prompt).not.toMatch(/\bvoice\b/i);
    expect(prompt).not.toMatch(/pronunc/i);
  });

  it("is unaffected by voice gender", () => {
    const base = PRESET_PERSONAS["sarah chen"];
    expect(generatePersonaPrompt({ ...base, voiceGender: "male" })).toBe(
      generatePersonaPrompt({ ...base, voiceGender: "female" }),
    );
  });
});

describe("describeResolvedVoice", () => {
  it("names the voice when there is an accent", () => {
    const text = describeResolvedVoice(
      resolveVoiceForPersona({ nationality: "Indian", voiceGender: "female" }),
      "Priya Sharma",
      "Indian",
    );
    expect(text).toContain("Priya Sharma");
    expect(text).toContain("Neerja");
  });

  it("says why there is none, rather than going quiet", () => {
    // A silent fallback reads as a broken feature. Naming the reason turns it
    // into a stated limitation, which is also what REQUIREMENTS E6 asks for.
    const text = describeResolvedVoice(
      resolveVoiceForPersona({ nationality: "Martian" }),
      "Zog",
      "Martian",
    );
    expect(text).toContain("Martian");
    expect(text).toContain("neutral English");
  });
});

describe("describeVoiceBriefly", () => {
  const accented: ResolvedVoice = {
    uri: "en-SG-LunaNeural",
    locale: "en-SG",
    label: "Luna — en-SG",
    source: "nationality",
    reason: null,
  };
  const neutral: ResolvedVoice = {
    uri: "en-US-AriaNeural",
    locale: "en-US",
    label: "Aria — en-US",
    source: "default",
    reason: "no-accent-for-nationality",
  };

  it("names the accent and the voice when both resolved", () => {
    expect(describeVoiceBriefly(accented, "Singaporean", "female")).toBe(
      "Singaporean accent · Female",
    );
    expect(describeVoiceBriefly(accented, "Singaporean", "unspecified")).toBe(
      "Singaporean accent",
    );
  });

  it("claims only neutral English on any fallback", () => {
    // Whether the default voice honours the gender preference is the
    // catalogue's business; the card says only what it knows.
    expect(describeVoiceBriefly(neutral, "Swedish", "female")).toBe(
      "Neutral English",
    );
    expect(
      describeVoiceBriefly(
        { ...neutral, reason: "accents-off" },
        "Swedish",
        undefined,
      ),
    ).toBe("Neutral English");
  });
});
