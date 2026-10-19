import { describe, expect, it } from "vitest";

import {
  ANALYZER_MODEL,
  COACH_MODEL,
  EMBEDDING_MODEL,
  INTERVIEWER_MODEL,
  JD_CLEAN_MODEL,
  JUDGE_MODEL,
  MODEL_RETIREMENTS,
  retirementNotice,
  SUMMARY_MODEL,
} from "@/lib/models";
import { modelFamily } from "@/lib/model-params";
import { MODEL_PRICING } from "@/lib/pricing";

describe("the model registry", () => {
  it("prices every default and every announced replacement", () => {
    const models = [
      INTERVIEWER_MODEL,
      COACH_MODEL,
      ANALYZER_MODEL,
      SUMMARY_MODEL,
      JD_CLEAN_MODEL,
      JUDGE_MODEL,
      EMBEDDING_MODEL,
      ...Object.values(MODEL_RETIREMENTS).flatMap((r) => [
        r.replacement,
        r.candidate,
      ]),
    ];
    for (const model of models) {
      expect(MODEL_PRICING[model], `no price for ${model}`).toBeTruthy();
    }
  });

  it("keeps the eval judge off the generation of the models it judges", () => {
    expect(modelFamily(JUDGE_MODEL)).not.toBe(modelFamily(INTERVIEWER_MODEL));
    expect(modelFamily(JUDGE_MODEL)).not.toBe(modelFamily(COACH_MODEL));
  });

  it("records retirements as ISO dates with a replacement and a candidate", () => {
    for (const [model, r] of Object.entries(MODEL_RETIREMENTS)) {
      expect(r.shutdown, model).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.replacement, model).not.toBe(model);
      expect(r.candidate, model).not.toBe(model);
    }
  });

  it("writes a notice only for a model with an announced date", () => {
    expect(retirementNotice("gpt-4o-mini")).toContain("2027-01-14");
    expect(retirementNotice("gpt-6-luna")).toBeNull();
  });
});
