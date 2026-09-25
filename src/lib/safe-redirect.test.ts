import { describe, expect, it } from "vitest";

import { safeRedirectPath } from "@/lib/safe-redirect";

describe("safeRedirectPath", () => {
  it("follows a path on this site, query and all", () => {
    expect(safeRedirectPath("/dashboard/sessions?tab=archived")).toBe(
      "/dashboard/sessions?tab=archived",
    );
  });

  it.each([
    null,
    "",
    "https://evil.example/login",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "dashboard",
  ])("falls back to the dashboard for %j", (value) => {
    expect(safeRedirectPath(value)).toBe("/dashboard");
  });
});
