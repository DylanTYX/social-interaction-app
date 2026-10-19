import { describe, expect, it } from "vitest";

import {
  buildChecks,
  candidateModels,
  currentModels,
  type SiteModels,
} from "./model-check";

const byName = (models: SiteModels) =>
  Object.fromEntries(buildChecks(models).map((c) => [c.site, c]));

describe("candidateModels", () => {
  it("moves each retiring default to its candidate and leaves the rest", () => {
    const next = candidateModels({
      interviewer: "gpt-5-mini",
      coach: "gpt-5-mini",
      analyzer: "gpt-4o-mini",
      summary: "gpt-4o-mini",
      jdClean: "gpt-4o-mini",
      judge: "gpt-4o-mini",
      embedding: "text-embedding-3-small",
    });
    expect(next.interviewer).toBe("gpt-5.6-luna");
    expect(next.coach).toBe("gpt-5.6-luna");
    expect(next.analyzer).toBe("gpt-6-luna");
    expect(next.judge).toBe("gpt-6-luna");
    expect(next.embedding).toBe("text-embedding-3-small");
  });

  it("does not move a model that has no announced retirement", () => {
    const next = candidateModels({ ...currentModels(), analyzer: "gpt-6-luna" });
    expect(next.analyzer).toBe("gpt-6-luna");
  });
});

describe("buildChecks", () => {
  it("covers every call site once", () => {
    expect(buildChecks(currentModels()).map((c) => c.site)).toEqual([
      "interviewer",
      "coach",
      "assessor",
      "summary",
      "jd tidy-up",
      "eval judge",
      "embeddings",
    ]);
  });

  it("sends the classic contract to a classic model", () => {
    const sites = byName({ ...currentModels(), analyzer: "gpt-4o-mini" });
    expect(sites.assessor.body).toMatchObject({
      temperature: 0.1,
      max_tokens: 24,
      response_format: { type: "json_object" },
    });
    expect(sites.assessor.body).not.toHaveProperty("reasoning_effort");
  });

  it("sends the gpt-5 contract: no temperature, an effort, a completion cap", () => {
    const sites = byName({ ...currentModels(), interviewer: "gpt-5-mini" });
    expect(sites.interviewer.body).not.toHaveProperty("temperature");
    expect(sites.interviewer.body).not.toHaveProperty("max_tokens");
    expect(sites.interviewer.body).toMatchObject({
      reasoning_effort: "minimal",
      max_completion_tokens: 24,
      stream: true,
      stream_options: { include_usage: true },
    });
  });

  it("sends the current contract to the candidates", () => {
    const sites = byName(candidateModels());
    // `none` is the one effort at which the sampling parameters apply.
    expect(sites.assessor.body).toMatchObject({
      model: "gpt-6-luna",
      temperature: 0.1,
      reasoning_effort: "none",
      response_format: { type: "json_object" },
    });
    expect(sites.interviewer.body).toMatchObject({
      model: "gpt-5.6-luna",
      temperature: 0.7,
      reasoning_effort: "none",
    });
    // The coach asks for `low`, and a model that is reasoning takes no temperature.
    expect(sites.coach.body).toMatchObject({ reasoning_effort: "low" });
    expect(sites.coach.body).not.toHaveProperty("temperature");
  });

  it("asks for JSON mode exactly where the app does", () => {
    const sites = byName(currentModels());
    const jsonSites = Object.values(sites)
      .filter((c) => c.expectsJson)
      .map((c) => c.site);
    expect(jsonSites).toEqual(["coach", "assessor", "jd tidy-up", "eval judge"]);
    for (const site of jsonSites) {
      expect(sites[site].body).toMatchObject({
        response_format: { type: "json_object" },
      });
    }
  });
});
