import { describe, expect, it } from "vitest";

import { isJobDescriptionMissing } from "@/hooks/use-interview-session-bootstrap";
import { createDefaultInterviewSetup } from "@/lib/interview-setup";
import type { SessionLaunchMeta } from "@/lib/session-launch-meta";

/**
 * The "ghost job description" case.
 *
 * A session is launched with a JD, abandoned, the JD is deleted, and the
 * session is resumed. The FK is `on delete set null`, so the column clears and
 * the chunks cascade — but `launch_meta` is a snapshot and keeps naming the
 * document. Resuming used to trust the snapshot, so the screen showed a
 * confident "grounded on this JD" chip while the prompt and the scoring pass
 * had silently lost it.
 *
 * Reproducing that by hand takes several minutes and a destructive action, so
 * the predicate is pinned here instead.
 */

const DEFAULT = createDefaultInterviewSetup();

function launchMeta(
  jobDescription: Partial<SessionLaunchMeta["jobDescription"]>,
): SessionLaunchMeta {
  return {
    streamResponses: DEFAULT.streamResponses,
    liveCoachingEnabled: DEFAULT.liveCoachingEnabled,
    interviewLoop: DEFAULT.interviewLoop,
    voiceConfig: DEFAULT.voiceConfig,
    jobDescription: { ...DEFAULT.jobDescription, ...jobDescription },
  };
}

const ATTACHED = launchMeta({ enabled: true, savedId: "jd-1" });

describe("isJobDescriptionMissing", () => {
  it("is true when the snapshot names a JD and both current sources are empty", () => {
    expect(
      isJobDescriptionMissing(ATTACHED, { jobDescriptionId: null }, null),
    ).toBe(true);
  });

  it("is false while the JD still exists", () => {
    expect(
      isJobDescriptionMissing(ATTACHED, { jobDescriptionId: "jd-1" }, {
        id: "jd-1",
      }),
    ).toBe(false);
  });

  it("is false for a session that never had a JD", () => {
    // The common case by a wide margin. Getting this wrong would put an
    // "unavailable" warning on every ordinary practice session.
    expect(
      isJobDescriptionMissing(
        launchMeta({ enabled: false, savedId: null }),
        { jobDescriptionId: null },
        null,
      ),
    ).toBe(false);
  });

  it("is false when the JD was pasted rather than saved", () => {
    // `enabled` with no `savedId` means the text was pasted inline at setup and
    // never became a library row, so there is nothing that could have been
    // deleted.
    expect(
      isJobDescriptionMissing(
        launchMeta({ enabled: true, savedId: null }),
        { jobDescriptionId: null },
        null,
      ),
    ).toBe(false);
  });

  it("is false when only one of the two current sources is empty", () => {
    // The column and the lookup fail independently — the lookup also returns
    // null when the row is merely unreadable. Requiring both keeps a transient
    // read failure from telling the user their JD was deleted.
    expect(
      isJobDescriptionMissing(ATTACHED, { jobDescriptionId: "jd-1" }, null),
    ).toBe(false);
    expect(
      isJobDescriptionMissing(ATTACHED, { jobDescriptionId: null }, {
        id: "jd-1",
      }),
    ).toBe(false);
  });

  it("is false for a legacy session with no launch meta", () => {
    // Pre-0009 rows have no snapshot, so there is no claim to contradict.
    expect(isJobDescriptionMissing(null, { jobDescriptionId: null }, null)).toBe(
      false,
    );
  });
});
