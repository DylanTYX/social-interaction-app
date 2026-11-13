import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  type CsvRow,
  formatSummary,
  parseCsv,
  readPlanCases,
  summarise,
  susScore,
} from "@/eval/uat-summary";

describe("parseCsv", () => {
  it("reads a spreadsheet export, quotes and all", () => {
    const text =
      '﻿Tester,Notes\r\nP01,"Said ""fine"", then paused"\r\nP02,"two\nlines"\r\n,\r\n';
    expect(parseCsv(text)).toEqual([
      { Tester: "P01", Notes: 'Said "fine", then paused' },
      { Tester: "P02", Notes: "two\nlines" },
    ]);
  });
});

describe("readPlanCases", () => {
  const plan = readPlanCases(
    readFileSync(join(process.cwd(), "docs", "UAT.md"), "utf8"),
  );

  it("finds the nine smoke tests", () => {
    expect(plan.smoke).toEqual(
      Array.from({ length: 9 }, (_, i) => `S${i + 1}`),
    );
  });

  it("gives every case its own ID", () => {
    // A result is logged against an ID; two cases sharing one could not be
    // told apart. The report quotes the functional count — change both together.
    const all = [...plan.smoke, ...plan.functional];
    expect(new Set(all).size).toBe(all.length);
    expect(plan.functional).toHaveLength(83);
  });
});

describe("susScore", () => {
  it("follows Brooke's scoring", () => {
    expect(susScore([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100);
    expect(susScore([3, 3, 3, 3, 3, 3, 3, 3, 3, 3])).toBe(50);
    expect(susScore([4, 2, 4, 2, 4, 2, 4, 2, 4, 2])).toBe(75);
  });
});

const PLAN = { smoke: ["S1", "S2"], functional: ["T1", "T2", "T3"] };
const RATINGS = (u: number) =>
  Object.fromEntries(
    [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12].map((n) => [`U${n}`, String(u)]),
  );
const SUS_ALL = (odd: number, even: number) =>
  Object.fromEntries(
    Array.from({ length: 10 }, (_, i) => [
      `SUS${i + 1}`,
      String(i % 2 === 0 ? odd : even),
    ]),
  );

function tester(id: string, group: string, extra: CsvRow = {}): CsvRow {
  return {
    Tester: id,
    Group: group,
    Script: "B",
    Date: "2026-10-20",
    Device: "desktop",
    Browser: "Chrome",
    "Task interview": "yes",
    ...extra,
  };
}

function run(
  testerId: string,
  caseId: string,
  result: string,
  extra: CsvRow = {},
): CsvRow {
  return {
    Date: "2026-10-20",
    Tester: testerId,
    Case: caseId,
    Result: result,
    ...extra,
  };
}

describe("summarise", () => {
  const testers = [
    tester("P01", "student", { ...RATINGS(4), ...SUS_ALL(4, 2) }),
    tester("P02", "friends-family", { ...RATINGS(3), ...SUS_ALL(5, 1) }),
    tester("D01", "developer", { ...RATINGS(1), "Task interview": "no" }),
  ];

  it("counts only people who did not build it", () => {
    const s = summarise({ plan: PLAN, testers, cases: [], bugs: [] });
    expect(s.testers).toMatchObject({
      total: 2,
      students: 1,
      friendsFamily: 1,
    });
    // The developer's 1s would drag this down if they were counted.
    expect(s.items.find((i) => i.id === "U1")!.all).toEqual({
      mean: 3.5,
      n: 2,
    });
    expect(s.sus.all).toMatchObject({ mean: 87.5, min: 75, max: 100, n: 2 });
    expect(s.sus.students).toMatchObject({ mean: 75, n: 1 });
  });

  it("judges a re-tested case on its latest run", () => {
    const cases = [
      run("P01", "T1", "fail", { Bug: "UAT-001" }),
      run("P01", "T1", "pass", { Date: "2026-10-22" }),
      run("P02", "T2", "pass"),
      run("P02", "T2", "fail", {
        Device: "mobile",
        Browser: "Safari",
        Bug: "UAT-002",
      }),
      run("P02", "T3", "skip"),
      run("D01", "T3", "pass"),
    ];
    const s = summarise({ plan: PLAN, testers, cases, bugs: [] });
    // T2 passed on a laptop but fails on a phone; T3 was only run by the
    // developer, so as acceptance evidence it was not run at all.
    expect(s.functional).toEqual({
      inPlan: 3,
      run: 2,
      passed: 1,
      failing: ["T2"],
    });
    expect(s.testers.lastDate).toBe("2026-10-22");
  });

  it("needs the smoke tests on both desktop browsers", () => {
    const chromeOnly = [run("D01", "S1", "pass"), run("D01", "S2", "pass")];
    const both = [
      ...chromeOnly,
      run("D01", "S1", "pass", { Browser: "Safari" }),
      run("D01", "S2", "pass", { Browser: "Safari" }),
    ];
    const smoke = (cases: CsvRow[]) =>
      summarise({ plan: PLAN, testers, cases, bugs: [] }).criteria[0];

    expect(smoke(chromeOnly)).toMatchObject({
      met: false,
      result: "Chrome 2 of 2; Safari 0 of 2 (not passing: S1, S2)",
    });
    expect(smoke(both).met).toBe(true);
    expect(smoke([]).met).toBeNull();
  });

  it("claims nothing before anyone has tested", () => {
    const s = summarise({ plan: PLAN, testers: [], cases: [], bugs: [] });
    expect(s.criteria.map((c) => c.met)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("applies the bug criteria to open bugs only", () => {
    const bugs: CsvRow[] = [
      {
        "Bug ID": "UAT-001",
        Severity: "Blocker",
        Summary: "x",
        Status: "Fixed",
      },
      { "Bug ID": "UAT-002", Severity: "Major", Summary: "x", Status: "Open" },
      {
        "Bug ID": "UAT-003",
        Severity: "major",
        Summary: "x",
        Status: "",
        Workaround: "Paste instead",
      },
      { "Bug ID": "UAT-004", Severity: "", Summary: "", Status: "Open" },
    ];
    const s = summarise({ plan: PLAN, testers, cases: [], bugs });
    expect(s.bugs).toEqual({ Blocker: 1, Major: 2, Minor: 0, Cosmetic: 0 });
    expect(s.criteria[1]).toMatchObject({ result: "0", met: true });
    expect(s.criteria[2]).toMatchObject({
      result: "2, 1 without a workaround (UAT-002)",
      met: false,
    });
  });

  it("holds the usability mark against each item, not their average", () => {
    const mixed = [
      tester("P01", "student", { ...RATINGS(5), U4: "2" }),
      tester("P02", "student", { ...RATINGS(5), U4: "3" }),
    ];
    const s = summarise({ plan: PLAN, testers: mixed, cases: [], bugs: [] });
    // Pooled, the four items average 4.4; U4 alone is 2.5.
    expect(s.criteria[3].met).toBe(false);
  });

  it("reports what it could not count instead of guessing", () => {
    const s = summarise({
      plan: PLAN,
      testers: [
        tester("Priya Tan", "student"),
        tester("P02", "student", { U3: "6", SUS1: "4" }),
      ],
      cases: [run("P02", "X9", "pass"), run("P02", "T1", "fail")],
      bugs: [],
    });
    expect(s.warnings.join("\n")).toMatch(/should be a code such as P01/);
    expect(s.warnings.join("\n")).toMatch(/"6" is not a rating/);
    expect(s.warnings.join("\n")).toMatch(/1 of 10 SUS items/);
    expect(s.warnings.join("\n")).toMatch(/"X9" is not a case in the plan/);
    expect(s.warnings.join("\n")).toMatch(/T1 fail without a Bug ID/);
    expect(s.sus.all.n).toBe(0);
  });
});

describe("the practice logs", () => {
  const dir = join(process.cwd(), "docs", "artifacts", "uat-sample");
  const read = (name: string) =>
    parseCsv(readFileSync(join(dir, name), "utf8"));
  const input = {
    plan: readPlanCases(
      readFileSync(join(process.cwd(), "docs", "UAT.md"), "utf8"),
    ),
    testers: read("UAT-testers.csv"),
    cases: read("UAT-case-log.csv"),
    bugs: read("UAT-bug-log.csv"),
  };

  it("marks every row as invented, and says so at both ends", () => {
    const rows = [...input.testers, ...input.cases, ...input.bugs];
    expect(rows.every((row) => row.Synthetic === "TRUE")).toBe(true);
    const lines = formatSummary(summarise(input)).split("\n");
    expect(lines[0]).toMatch(/^SAMPLE DATA/);
    expect(lines.at(-1)).toMatch(/^SAMPLE DATA/);
  });

  it("still matches the plan", () => {
    // A renamed or removed case would turn the worked example into warnings.
    expect(summarise(input).warnings).toEqual([]);
  });
});
