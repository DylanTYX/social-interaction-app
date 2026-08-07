import { describe, expect, it } from "vitest";

import { isNavItemActive } from "@/lib/nav";

describe("isNavItemActive", () => {
  it("lights up the item you are actually on", () => {
    expect(isNavItemActive("/dashboard", "/dashboard")).toBe(true);
    expect(isNavItemActive("/dashboard/sessions", "/dashboard/sessions")).toBe(
      true,
    );
  });

  it("does NOT light up Dashboard when you are on a dashboard sub-page", () => {
    // The bug this file exists for. `/dashboard` is a prefix of every dashboard
    // route, so the old shared rule matched twice and lit two items at once.
    expect(isNavItemActive("/dashboard/sessions", "/dashboard")).toBe(false);
    expect(isNavItemActive("/dashboard/analytics", "/dashboard")).toBe(false);
    expect(isNavItemActive("/dashboard/settings", "/dashboard")).toBe(false);
  });

  it("exactly one nav item matches any dashboard route", () => {
    // The property that actually matters, asserted over the real nav list
    // rather than one case at a time.
    const hrefs = [
      "/dashboard",
      "/dashboard/drills",
      "/dashboard/sessions",
      "/dashboard/personas",
      "/dashboard/job-descriptions",
      "/dashboard/resumes",
      "/dashboard/analytics",
      "/dashboard/help",
      "/dashboard/settings",
    ];

    for (const pathname of hrefs) {
      const matches = hrefs.filter((href) => isNavItemActive(pathname, href));
      expect(matches, `${pathname} matched ${matches.join(", ")}`).toEqual([
        pathname,
      ]);
    }
  });

  it("keeps a section lit on its own child routes", () => {
    // Prefix matching is still correct below a section index — this is why the
    // fix is an exception list rather than exact-match everywhere.
    expect(
      isNavItemActive("/dashboard/sessions/abc", "/dashboard/sessions"),
    ).toBe(true);
    expect(isNavItemActive("/simulate/setup/step-2", "/simulate/setup")).toBe(
      true,
    );
  });

  it("does not match a sibling that merely shares a prefix string", () => {
    // `/dashboard/resumes` must not light up on `/dashboard/resumes-archive`.
    expect(
      isNavItemActive("/dashboard/resumes-archive", "/dashboard/resumes"),
    ).toBe(false);
  });

  it("treats the marketing root as exact, not a prefix of the whole app", () => {
    expect(isNavItemActive("/", "/")).toBe(true);
    expect(isNavItemActive("/dashboard", "/")).toBe(false);
  });

  it("leaves every item unlit on routes with no nav entry", () => {
    // The live interview has no nav at all; nothing should claim to be active.
    for (const href of ["/dashboard", "/dashboard/sessions"]) {
      expect(isNavItemActive("/simulate/chat", href)).toBe(false);
    }
  });
});
