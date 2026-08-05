import { describe, expect, it } from "vitest";

import { selectRoundPlaybook } from "@/lib/interviewer-playbooks";
import { ROUND_TYPES } from "@/lib/interview-rounds";

describe("selectRoundPlaybook", () => {
  it("gives every round type its own playbook", () => {
    // Regression guard. This used to tag-match and return the first entry in
    // array order, so `hr` got the screening playbook, `system_design` got the
    // generic technical one, and `technical_swe` got the vagueness rule — three
    // round types silently mis-guided, and `hr-people` unreachable.
    for (const roundType of ROUND_TYPES) {
      expect(selectRoundPlaybook(roundType), roundType).not.toBeNull();
    }
  });

  it("maps the round types that used to collide", () => {
    expect(selectRoundPlaybook("hr")?.id).toBe("hr-people");
    expect(selectRoundPlaybook("system_design")?.id).toBe("system-design");
    expect(selectRoundPlaybook("technical_swe")?.id).toBe("technical-framing");
    expect(selectRoundPlaybook("screening")?.id).toBe("screening-fit");
    expect(selectRoundPlaybook("behavioral")?.id).toBe("behavioral-star");
  });

  it("returns null without a round type", () => {
    expect(selectRoundPlaybook(undefined)).toBeNull();
  });

  it("gives each round type distinct guidance where it should", () => {
    const hr = selectRoundPlaybook("hr")?.content ?? "";
    const screening = selectRoundPlaybook("screening")?.content ?? "";
    expect(hr).not.toBe(screening);
  });
});
