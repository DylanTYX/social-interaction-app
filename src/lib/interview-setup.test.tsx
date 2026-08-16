import { beforeEach, describe, expect, it } from "vitest";

import {
  loadInterviewSetup,
  saveInterviewSetup,
  updateInterviewSetup,
  createDefaultInterviewSetup,
  resolveLaunchAttachment,
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

  it("never restores job-description text, chosen or not", () => {
    /**
     * `jobDescription.rawText` is vestigial and must always load as empty.
     *
     * The wizard used to compose a draft in the card and turn it into a record
     * at launch. Creation now happens in a dialog that owns its own draft, and
     * nothing reads this field: not the picker, not `launchInterview`, and not
     * `LoopStep`, which takes its text from the library row.
     *
     * Both directions matter. A blob from an older build can carry a draft
     * *alongside* a chosen id, and `LoopStep` used to read `rawText` to decide
     * whether it could suggest rounds — so leftover text would have it
     * suggesting rounds from a document the interview is not using. And a
     * draft with no id is text that storage holds but no surface renders,
     * which is worse than losing it: the user is told nothing and sees nothing.
     */
    const base = createDefaultInterviewSetup();

    saveInterviewSetup({
      ...base,
      jobDescription: {
        ...base.jobDescription,
        enabled: true,
        savedId: "jd-1",
        savedTitle: "Data Analyst at Monzo",
        rawText: "a stale draft left over from an older build",
      },
    });
    const withSelection = loadInterviewSetup();
    expect(withSelection?.jobDescription.savedId).toBe("jd-1");
    expect(withSelection?.jobDescription.rawText).toBe("");

    saveInterviewSetup({
      ...base,
      jobDescription: {
        ...base.jobDescription,
        enabled: true,
        savedId: null,
        rawText: "half a job description, still being pasted",
      },
    });
    expect(loadInterviewSetup()?.jobDescription.rawText).toBe("");
  });

  it("still restores an unsaved CV draft", () => {
    // The resume picker does still compose in place, so its `rawText` is live
    // state rather than a leftover. The two configs share a shape but not a
    // lifecycle, and the normalizer must keep telling them apart.
    const base = createDefaultInterviewSetup();
    saveInterviewSetup({
      ...base,
      resume: {
        ...base.resume,
        enabled: true,
        savedId: null,
        rawText: "half a CV, still being pasted",
      },
    });

    expect(loadInterviewSetup()?.resume.rawText).toBe(
      "half a CV, still being pasted",
    );
  });

  it("starts from defaults when nothing is stored yet", () => {
    updateInterviewSetup({ practiceMode: "voice" });

    const stored = loadInterviewSetup();
    expect(stored?.practiceMode).toBe("voice");
    expect(stored?.interviewLoop).toBeDefined();
  });
});

describe("resolveLaunchAttachment", () => {
  /**
   * Launch selects, never creates. This is the whole of that rule: given an
   * enabled document it can only ever hand back an id that was already in the
   * library, so there is no path left on which launching POSTs a new row.
   */
  const DEFAULT = createDefaultInterviewSetup();

  it("returns the chosen id when the row is still in the library", () => {
    const result = resolveLaunchAttachment(
      "CV",
      { ...DEFAULT.resume, enabled: true, savedId: "cv-1" },
      { id: "cv-1" },
    );

    expect(result).toEqual({ id: "cv-1" });
  });

  it("returns no id at all when the document is switched off", () => {
    // Including when a stale `savedId` is still sitting on the config, which is
    // the normal state after toggling off — the id is kept so toggling back on
    // restores the choice.
    expect(
      resolveLaunchAttachment(
        "CV",
        { ...DEFAULT.resume, enabled: false, savedId: "cv-1" },
        { id: "cv-1" },
      ),
    ).toEqual({ id: null });
  });

  it("refuses an enabled document with nothing chosen", () => {
    const result = resolveLaunchAttachment("job description", {
      ...DEFAULT.jobDescription,
      enabled: true,
      savedId: null,
    }, null);

    expect(result).toEqual({
      error: "Choose or add a job description before launching, or turn it off.",
    });
  });

  it("refuses an id the library no longer has", () => {
    // Deleted in another tab, or since the wizard loaded. This used to reach
    // the foreign key and come back as an opaque 500 at launch, after the user
    // had finished setting the interview up.
    const result = resolveLaunchAttachment(
      "CV",
      { ...DEFAULT.resume, enabled: true, savedId: "cv-gone" },
      null,
    );

    expect(result).toEqual({
      error:
        "That CV is no longer in your library. Choose another, or turn it off.",
    });
  });
});
