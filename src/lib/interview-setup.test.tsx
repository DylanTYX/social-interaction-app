import { beforeEach, describe, expect, it } from "vitest";

import {
  loadInterviewSetup,
  saveInterviewSetup,
  updateInterviewSetup,
  createDefaultInterviewSetup,
} from "@/lib/interview-setup";

/**
 * Partial updates to the stored setup.
 *
 * `.test.tsx` purely for the environment: `environmentMatchGlobs` gives this
 * file jsdom, and `localStorage` is what the module under test uses. There is
 * no component here.
 *
 * The bug this guards: both interview screens re-save the setup after every
 * session so the wizard reflects what you ran, and neither has the document
 * config to hand — so both passed `DEFAULT_SETUP.jobDescription` and
 * `DEFAULT_SETUP.resume`, turning the user's job description and CV back *off*
 * every single session.
 */

beforeEach(() => {
  window.localStorage.clear();
});

function storedWithDocuments() {
  const base = createDefaultInterviewSetup();
  saveInterviewSetup({
    ...base,
    jobDescription: {
      ...base.jobDescription,
      enabled: true,
      savedId: "jd-1",
    },
    resume: { ...base.resume, enabled: true, savedId: "cv-1" },
  });
}

describe("updateInterviewSetup", () => {
  it("leaves fields the caller did not mention alone", () => {
    storedWithDocuments();

    // What the interview screens actually send: everything except documents.
    updateInterviewSetup({ practiceMode: "voice" });

    const stored = loadInterviewSetup();
    expect(stored?.practiceMode).toBe("voice");
    expect(stored?.jobDescription.enabled).toBe(true);
    expect(stored?.jobDescription.savedId).toBe("jd-1");
    expect(stored?.resume.enabled).toBe(true);
    expect(stored?.resume.savedId).toBe("cv-1");
  });

  it("applies the fields it is given", () => {
    storedWithDocuments();
    updateInterviewSetup({ liveCoachingEnabled: false });
    expect(loadInterviewSetup()?.liveCoachingEnabled).toBe(false);
  });

  it("can still clear a document deliberately", () => {
    // Preserving an omitted field must not mean a field can never be changed.
    storedWithDocuments();
    const base = createDefaultInterviewSetup();

    updateInterviewSetup({ resume: base.resume });

    expect(loadInterviewSetup()?.resume.enabled).toBe(false);
    // ...and the untouched one survives.
    expect(loadInterviewSetup()?.jobDescription.enabled).toBe(true);
  });

  it("starts from defaults when nothing is stored yet", () => {
    updateInterviewSetup({ practiceMode: "voice" });

    const stored = loadInterviewSetup();
    expect(stored?.practiceMode).toBe("voice");
    expect(stored?.interviewLoop).toBeDefined();
  });
});
