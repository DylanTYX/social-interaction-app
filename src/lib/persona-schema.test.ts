import { describe, expect, it } from "vitest";

import { parsePersonaConfig } from "@/lib/persona-schema";

const MINIMAL = {
  name: "Alex Chen",
  nationality: "Singaporean",
  industry: "Technology",
  seniority: "Senior Engineering Manager",
};

describe("parsePersonaConfig", () => {
  it("rejects anything that is not an object", () => {
    expect(parsePersonaConfig(null)).toBeNull();
    expect(parsePersonaConfig(undefined)).toBeNull();
    expect(parsePersonaConfig("persona")).toBeNull();
    expect(parsePersonaConfig(42)).toBeNull();
  });

  it("requires the four fields that have no sensible default", () => {
    for (const key of Object.keys(MINIMAL)) {
      const partial = { ...MINIMAL, [key]: "" };
      expect(parsePersonaConfig(partial)).toBeNull();
    }
  });

  it("fills every remaining field rather than lying about them", () => {
    // The three route-local copies this replaced checked only the four fields
    // above and then cast, so `strictness`/`warmth` reached arithmetic in
    // decideInterviewAction unvalidated and `communicationStyle` indexed a
    // Record that yielded undefined.
    const config = parsePersonaConfig(MINIMAL);

    expect(config).not.toBeNull();
    expect(config!.communicationStyle).toBe("direct");
    expect(config!.strictness).toBe(5);
    expect(config!.warmth).toBe(5);
    expect(config!.yearsExperience).toBe(0);
    expect(config!.personalityTraits).toEqual([]);
    expect(config!.boundaries).toEqual([]);
    expect(config!.interestAreas).toEqual([]);
  });

  it("clamps out-of-range dials instead of trusting them", () => {
    const config = parsePersonaConfig({
      ...MINIMAL,
      strictness: 99,
      warmth: -4,
      pace: 7.6,
    });

    expect(config!.strictness).toBe(10);
    expect(config!.warmth).toBe(1);
    expect(config!.pace).toBe(8);
  });

  it("falls back on an unrecognised communication style", () => {
    const config = parsePersonaConfig({
      ...MINIMAL,
      communicationStyle: "telepathic",
    });
    expect(config!.communicationStyle).toBe("direct");
  });

  it("keeps a valid communication style", () => {
    const config = parsePersonaConfig({
      ...MINIMAL,
      communicationStyle: "analytical",
    });
    expect(config!.communicationStyle).toBe("analytical");
  });

  it("drops non-string entries from list fields", () => {
    const config = parsePersonaConfig({
      ...MINIMAL,
      personalityTraits: ["analytical", 7, null, "impatient"],
      boundaries: "not an array",
    });

    expect(config!.personalityTraits).toEqual(["analytical", "impatient"]);
    expect(config!.boundaries).toEqual([]);
  });

  it("trims whitespace on the required fields", () => {
    const config = parsePersonaConfig({ ...MINIMAL, name: "  Alex Chen  " });
    expect(config!.name).toBe("Alex Chen");
  });
});

describe("blank persona round trip", () => {
  it("survives parsePersonaConfig with every field intact once identity is filled", async () => {
    // Guards the class of bug this file already documents: parsePersonaConfig
    // rebuilds a fresh literal rather than spreading its input, so a field
    // that is not named there is silently dropped on every save.
    const { createBlankPersonaConfig, personaIdentityComplete } =
      await import("@/lib/persona-library");
    const blank = createBlankPersonaConfig();
    expect(personaIdentityComplete(blank)).toBe(false);
    expect(parsePersonaConfig(blank)).toBeNull();

    const filled = {
      ...blank,
      name: "Ada Lovelace",
      nationality: "British",
      industry: "Computing",
      seniority: "Principal Engineer",
      questioningStyle: "bar_raiser" as const,
      voiceGender: "female" as const,
      probingDepth: 9 as const,
      unpredictability: 2 as const,
    };
    expect(personaIdentityComplete(filled)).toBe(true);
    expect(parsePersonaConfig(filled)).toEqual(filled);
  });
});
