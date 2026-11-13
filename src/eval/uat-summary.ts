/**
 * Turning the user acceptance test logs into the figures the report quotes.
 *
 * The plan (`docs/UAT.md`) is run by hand, and its results are kept in three
 * spreadsheets beside it: who tested (`UAT-testers.csv`), what each tester ran
 * and whether it passed (`UAT-case-log.csv`), and what broke
 * (`UAT-bug-log.csv`). This reads them and works out every number Section 5.19
 * of the report leaves blank, with each exit criterion's verdict.
 *
 * It is arithmetic a person could do, written down so that it is done the same
 * way every time and before any result is seen — the pass marks were fixed in
 * the plan, and the rules for applying them are fixed here: which tester counts,
 * which run of a re-tested case counts, what a missing questionnaire answer
 * does to a score. The case list is read from the plan itself, so a result
 * logged under an ID the plan does not have is reported rather than counted.
 */

import { mean } from "@/eval/stats";

export type CsvRow = Record<string, string>;

/**
 * Parse CSV as a spreadsheet exports it (RFC 4180): quoted fields may hold
 * commas, doubled quotes and line breaks. Rows with every field empty are
 * dropped, because spreadsheets leave them behind.
 */
export function parseCsv(text: string): CsvRow[] {
  const records: string[][] = [];
  let record: string[] = [];
  let value = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        value += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        value += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      record.push(value);
      value = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i++;
      record.push(value);
      records.push(record);
      record = [];
      value = "";
    } else {
      value += ch;
    }
  }
  if (value !== "" || record.length > 0) {
    record.push(value);
    records.push(record);
  }

  const [header, ...body] = records;
  if (!header) return [];
  const names = header.map((name) => name.trim());
  return body
    .filter((fields) => fields.some((field) => field.trim() !== ""))
    .map((fields) =>
      Object.fromEntries(names.map((name, i) => [name, fields[i] ?? ""])),
    );
}

export interface PlanCases {
  /** Section 3 of the plan, S1–S9. */
  smoke: string[];
  /** Every other row with a pass box. */
  functional: string[];
}

/** The case IDs in the plan, read from the rows that carry a pass box. */
export function readPlanCases(markdown: string): PlanCases {
  const smoke: string[] = [];
  const functional: string[] = [];
  let inSmoke = false;
  for (const line of markdown.split("\n")) {
    if (line.startsWith("## ")) inSmoke = line.startsWith("## 3.");
    const match = line.match(/^\|\s*([A-Z]{1,2}\d+[a-z]?)\s*\|.*☐/);
    if (match) (inSmoke ? smoke : functional).push(match[1]);
  }
  return { smoke, functional };
}

/** System Usability Scale score, 0–100 (Brooke, 1996). Ten ratings of 1–5. */
export function susScore(ratings: number[]): number {
  // Odd items are worded positively and even items negatively, so each is
  // turned into 0–4 the right way round before summing.
  const total = ratings.reduce(
    (sum, rating, i) => sum + (i % 2 === 0 ? rating - 1 : 5 - rating),
    0,
  );
  return total * 2.5;
}

const GROUPS = ["student", "friends-family", "developer"] as const;
type Group = (typeof GROUPS)[number];
const RESULTS = ["pass", "fail", "blocked", "skip"] as const;
type Result = (typeof RESULTS)[number];
const SEVERITIES = ["Blocker", "Major", "Minor", "Cosmetic"] as const;
type Severity = (typeof SEVERITIES)[number];
const DEVICES = ["desktop", "mobile", "tablet"];
const SCRIPTS = ["A", "B", "C", "D", "E", "F"];

/** The plan's five task-success checks (Section 5). */
export const TASKS = [
  { column: "Task demo", label: "landing demo" },
  { column: "Task account", label: "create account" },
  { column: "Task interview", label: "text interview" },
  { column: "Task history", label: "find past session" },
  { column: "Task job description", label: "add a job description" },
] as const;

/** Rated 1–5. U5 is a choice of three words, so it is counted, not averaged. */
const RATED_ITEMS = [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12].map((n) => `U${n}`);
const U5_ANSWERS = ["too long", "just right", "too short"];
/** The items the usability exit criterion is judged on. */
const EXIT_ITEMS = ["U1", "U4", "U6", "U7"];
const EXIT_MEAN = 3.5;
const SUS_ITEMS = Array.from({ length: 10 }, (_, i) => `SUS${i + 1}`);
/** Smoke tests must pass on both, on a desktop. */
const SMOKE_BROWSERS = ["Chrome", "Safari"];

export interface Stat {
  mean: number | null;
  n: number;
}
export interface SusStat extends Stat {
  min: number | null;
  max: number | null;
}
export interface Criterion {
  name: string;
  passMark: string;
  result: string;
  /** null when nothing has been logged that it could be judged on. */
  met: boolean | null;
}
export interface UatSummary {
  testers: {
    total: number;
    students: number;
    friendsFamily: number;
    firstDate: string | null;
    lastDate: string | null;
    setups: string[];
  };
  criteria: Criterion[];
  functional: {
    inPlan: number;
    run: number;
    passed: number;
    failing: string[];
  };
  bugs: Record<Severity, number>;
  items: { id: string; all: Stat; students: Stat }[];
  u5: Record<string, number>;
  sus: { all: SusStat; students: SusStat };
  tasks: { label: string; done: number; attempted: number }[];
  /** Rows marked `Synthetic` — the practice data, which is never a result. */
  synthetic: number;
  warnings: string[];
}

interface Tester {
  id: string;
  group: Group | null;
  date: string;
  device: string;
  browser: string;
  row: CsvRow;
}

interface Run {
  tester: string;
  caseId: string;
  device: string;
  browser: string;
  result: Result;
  date: string;
  order: number;
}

function field(row: CsvRow, name: string): string {
  return (row[name] ?? "").trim();
}

function browserName(raw: string): string {
  const lower = raw.toLowerCase();
  for (const name of ["Chrome", "Safari", "Edge", "Firefox"]) {
    if (lower.includes(name.toLowerCase())) return name;
  }
  return raw;
}

/** The latest run wins: a case re-tested after a fix is judged on the re-test. */
function latest(runs: Run[]): Run {
  return runs.reduce((a, b) =>
    b.date > a.date || (b.date === a.date && b.order > a.order) ? b : a,
  );
}

function statOf(values: number[]): Stat {
  return { mean: values.length ? mean(values) : null, n: values.length };
}

function list(ids: string[]): string {
  return ids.join(", ");
}

export function summarise(input: {
  plan: PlanCases;
  testers: CsvRow[];
  cases: CsvRow[];
  bugs: CsvRow[];
}): UatSummary {
  const warnings: string[] = [];
  const knownCases = new Set([...input.plan.smoke, ...input.plan.functional]);

  // ── Testers ──────────────────────────────────────────────────────────────
  const testers = new Map<string, Tester>();
  for (const row of input.testers) {
    const id = field(row, "Tester");
    if (!id) {
      warnings.push(
        "UAT-testers.csv has a row with no Tester code; it is ignored.",
      );
      continue;
    }
    if (!/^[A-Za-z]{1,3}\d{1,3}$/.test(id)) {
      warnings.push(
        `Tester "${id}" should be a code such as P01, not a name: these logs are kept in the repository.`,
      );
    }
    if (testers.has(id)) {
      warnings.push(
        `Tester ${id} appears twice in UAT-testers.csv; the first row is used.`,
      );
      continue;
    }
    const rawGroup = field(row, "Group").toLowerCase();
    const group = (GROUPS as readonly string[]).includes(rawGroup)
      ? (rawGroup as Group)
      : null;
    if (!group) {
      warnings.push(
        `Tester ${id}: group "${field(row, "Group")}" is not one of ${GROUPS.join(", ")}; they are left out of every count.`,
      );
    }
    const script = field(row, "Script").toUpperCase();
    if (script && !SCRIPTS.includes(script)) {
      warnings.push(
        `Tester ${id}: script "${script}" is not one of A–F (plan, Section 7).`,
      );
    }
    const device = field(row, "Device").toLowerCase();
    if (device && !DEVICES.includes(device)) {
      warnings.push(
        `Tester ${id}: device "${device}" is not desktop, mobile or tablet.`,
      );
    }
    testers.set(id, {
      id,
      group,
      date: field(row, "Date"),
      device,
      browser: browserName(field(row, "Browser")),
      row,
    });
  }

  // A developer's own runs check the build is ready; they are not acceptance
  // by a user, so they count for the smoke gate only.
  const participants = [...testers.values()].filter(
    (t) => t.group === "student" || t.group === "friends-family",
  );
  const students = participants.filter((t) => t.group === "student");

  function rating(tester: Tester, item: string): number | null {
    const raw = field(tester.row, item);
    if (!raw) return null;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      warnings.push(
        `Tester ${tester.id} ${item}: "${raw}" is not a rating from 1 to 5; it is left out.`,
      );
      return null;
    }
    return value;
  }

  function ratings(group: Tester[], item: string): number[] {
    return group
      .map((t) => rating(t, item))
      .filter((v): v is number => v !== null);
  }

  // ── Case runs ────────────────────────────────────────────────────────────
  const runs: Run[] = [];
  input.cases.forEach((row, order) => {
    const tester = field(row, "Tester");
    const caseId = field(row, "Case");
    const result = field(row, "Result").toLowerCase() as Result;
    const where = `UAT-case-log.csv row ${order + 2}`;
    if (!testers.has(tester)) {
      warnings.push(
        `${where}: tester "${tester}" is not in UAT-testers.csv; the run is ignored.`,
      );
      return;
    }
    if (!knownCases.has(caseId)) {
      warnings.push(
        `${where}: "${caseId}" is not a case in the plan; the run is ignored.`,
      );
      return;
    }
    if (!(RESULTS as readonly string[]).includes(result)) {
      warnings.push(
        `${where}: result "${field(row, "Result")}" is not pass, fail, blocked or skip; the run is ignored.`,
      );
      return;
    }
    if ((result === "fail" || result === "blocked") && !field(row, "Bug")) {
      warnings.push(
        `${where}: ${caseId} ${result} without a Bug ID, so the bug log will not show it.`,
      );
    }
    const t = testers.get(tester)!;
    const device = field(row, "Device").toLowerCase() || t.device;
    if (device && !DEVICES.includes(device)) {
      warnings.push(
        `${where}: device "${device}" is not desktop, mobile or tablet.`,
      );
    }
    // A skip is a case not run, not a result.
    if (result === "skip") return;
    runs.push({
      tester,
      caseId,
      device,
      browser: browserName(field(row, "Browser")) || t.browser,
      result,
      date: field(row, "Date"),
      order,
    });
  });

  // ── Smoke gate: every S case, latest run on desktop Chrome and on Safari ─
  const smokeParts: string[] = [];
  let smokeMet: boolean | null = true;
  const anySmokeRun = runs.some(
    (r) => input.plan.smoke.includes(r.caseId) && r.device === "desktop",
  );
  for (const browser of SMOKE_BROWSERS) {
    const notPassing: string[] = [];
    for (const id of input.plan.smoke) {
      const onBrowser = runs.filter(
        (r) =>
          r.caseId === id && r.device === "desktop" && r.browser === browser,
      );
      if (!onBrowser.length || latest(onBrowser).result !== "pass") {
        notPassing.push(id);
      }
    }
    const passed = input.plan.smoke.length - notPassing.length;
    smokeParts.push(
      `${browser} ${passed} of ${input.plan.smoke.length}` +
        (notPassing.length ? ` (not passing: ${list(notPassing)})` : ""),
    );
    if (notPassing.length) smokeMet = false;
  }
  if (!anySmokeRun) smokeMet = null;

  // ── Functional cases, run by participants ────────────────────────────────
  // A case passes when its latest run on every device and browser it was tried
  // on passed: a pass on a laptop does not cancel a failure on a phone.
  const participantIds = new Set(participants.map((t) => t.id));
  const failing: string[] = [];
  let run = 0;
  let passed = 0;
  for (const id of input.plan.functional) {
    const caseRuns = runs.filter(
      (r) => r.caseId === id && participantIds.has(r.tester),
    );
    if (!caseRuns.length) continue;
    run++;
    const bySetup = new Map<string, Run[]>();
    for (const r of caseRuns) {
      const key = `${r.device}|${r.browser}`;
      bySetup.set(key, [...(bySetup.get(key) ?? []), r]);
    }
    const allPass = [...bySetup.values()].every(
      (setupRuns) => latest(setupRuns).result === "pass",
    );
    if (allPass) passed++;
    else failing.push(id);
  }

  // ── Bugs ─────────────────────────────────────────────────────────────────
  const bugs = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<
    Severity,
    number
  >;
  const openBlockers: string[] = [];
  const openMajors: { id: string; workaround: boolean }[] = [];
  input.bugs.forEach((row, i) => {
    const id = field(row, "Bug ID") || `row ${i + 2}`;
    const rawSeverity = field(row, "Severity");
    // The template's numbered placeholder row has nothing else in it.
    if (!rawSeverity && !field(row, "Summary")) return;
    const severity = SEVERITIES.find(
      (s) => s.toLowerCase() === rawSeverity.toLowerCase(),
    );
    if (!severity) {
      warnings.push(
        `Bug ${id}: severity "${rawSeverity}" is not Blocker, Major, Minor or Cosmetic; it is not counted.`,
      );
      return;
    }
    const caseId = field(row, "Case");
    if (caseId && !knownCases.has(caseId)) {
      warnings.push(`Bug ${id}: case "${caseId}" is not in the plan.`);
    }
    const tester = field(row, "Tester");
    if (tester && !testers.has(tester)) {
      warnings.push(`Bug ${id}: tester "${tester}" is not in UAT-testers.csv.`);
    }
    bugs[severity]++;
    // A bug with no status has not been closed.
    const open = ["", "open"].includes(field(row, "Status").toLowerCase());
    if (!open) return;
    if (severity === "Blocker") openBlockers.push(id);
    if (severity === "Major") {
      openMajors.push({ id, workaround: field(row, "Workaround") !== "" });
    }
  });

  // ── Questionnaire ────────────────────────────────────────────────────────
  const items = RATED_ITEMS.map((id) => ({
    id,
    all: statOf(ratings(participants, id)),
    students: statOf(ratings(students, id)),
  }));
  const u5 = Object.fromEntries(U5_ANSWERS.map((a) => [a, 0]));
  for (const t of participants) {
    const answer = field(t.row, "U5").toLowerCase();
    if (!answer) continue;
    if (answer in u5) u5[answer]++;
    else
      warnings.push(
        `Tester ${t.id} U5: "${answer}" is not too long, just right or too short.`,
      );
  }

  function susOf(group: Tester[]): SusStat {
    const scores: number[] = [];
    for (const t of group) {
      const values = SUS_ITEMS.map((item) => rating(t, item));
      const answered = values.filter((v) => v !== null).length;
      // A partial questionnaire has no score: the scale is only defined over
      // all ten items, and filling the gaps would be inventing answers.
      if (answered === 10) scores.push(susScore(values as number[]));
      else if (answered > 0) {
        warnings.push(
          `Tester ${t.id} answered ${answered} of 10 SUS items, so has no SUS score.`,
        );
      }
    }
    return {
      ...statOf(scores),
      min: scores.length ? Math.min(...scores) : null,
      max: scores.length ? Math.max(...scores) : null,
    };
  }

  const tasks = TASKS.map(({ column, label }) => {
    let done = 0;
    let attempted = 0;
    for (const t of participants) {
      const answer = field(t.row, column).toLowerCase();
      if (!answer) continue;
      if (answer !== "yes" && answer !== "no") {
        warnings.push(
          `Tester ${t.id} ${column}: "${answer}" should be yes or no.`,
        );
        continue;
      }
      attempted++;
      if (answer === "yes") done++;
    }
    return { label, done, attempted };
  });

  // ── Exit criteria (plan, Section 8; report, Table 5.15) ──────────────────
  const exitItems = items.filter((item) => EXIT_ITEMS.includes(item.id));
  const usabilityMeasured = exitItems.every((item) => item.all.n > 0);
  const unaided = tasks.find((t) => t.label === "text interview")!;
  const majorsWithout = openMajors
    .filter((m) => !m.workaround)
    .map((m) => m.id);
  // No bugs open means nothing until somebody has tested.
  const tested = participants.length > 0 || runs.length > 0;

  const criteria: Criterion[] = [
    {
      name: "Smoke tests on desktop Chrome and Safari",
      passMark: "All 9 pass",
      result: anySmokeRun ? smokeParts.join("; ") : "not yet run",
      met: smokeMet,
    },
    {
      name: "Blocker bugs open",
      passMark: "0",
      result: openBlockers.length
        ? `${openBlockers.length} (${list(openBlockers)})`
        : "0",
      met: tested ? openBlockers.length === 0 : null,
    },
    {
      name: "Major bugs open",
      passMark: "At most 3, each with a workaround",
      result:
        `${openMajors.length}` +
        (majorsWithout.length
          ? `, ${majorsWithout.length} without a workaround (${list(majorsWithout)})`
          : ""),
      met: tested ? openMajors.length <= 3 && majorsWithout.length === 0 : null,
    },
    {
      name: "Mean usability score on U1, U4, U6 and U7",
      passMark: `Each at least ${EXIT_MEAN} of 5`,
      result: usabilityMeasured
        ? exitItems
            .map((item) => `${item.id} ${item.all.mean!.toFixed(1)}`)
            .join(", ") + ` (n = ${Math.min(...exitItems.map((i) => i.all.n))})`
        : "not yet measured",
      met: usabilityMeasured
        ? exitItems.every((item) => item.all.mean! >= EXIT_MEAN)
        : null,
    },
    {
      name: "Non-developer testers completing a text interview unaided",
      passMark: "At least 2",
      result: participants.length ? `${unaided.done}` : "not yet measured",
      met: participants.length ? unaided.done >= 2 : null,
    },
  ];

  // ── Method paragraph ─────────────────────────────────────────────────────
  const dates = [
    ...participants.map((t) => t.date),
    ...runs.filter((r) => participantIds.has(r.tester)).map((r) => r.date),
  ]
    .filter(Boolean)
    .sort();
  const setups = new Set<string>();
  for (const t of participants) {
    if (t.device || t.browser) setups.add(`${t.device} ${t.browser}`.trim());
  }
  for (const r of runs) {
    if (participantIds.has(r.tester) && (r.device || r.browser)) {
      setups.add(`${r.device} ${r.browser}`.trim());
    }
  }

  return {
    testers: {
      total: participants.length,
      students: students.length,
      friendsFamily: participants.length - students.length,
      firstDate: dates[0] ?? null,
      lastDate: dates.at(-1) ?? null,
      setups: [...setups].sort(),
    },
    criteria,
    functional: {
      inPlan: input.plan.functional.length,
      run,
      passed,
      failing,
    },
    bugs,
    items,
    u5,
    sus: { all: susOf(participants), students: susOf(students) },
    tasks,
    synthetic: [...input.testers, ...input.cases, ...input.bugs].filter((row) =>
      /^(true|yes|1)$/i.test(field(row, "Synthetic")),
    ).length,
    // The students are a subset of everyone, so a bad cell is met twice.
    warnings: [...new Set(warnings)],
  };
}

function fmt(value: number | null, digits = 1): string {
  return value === null ? "–" : value.toFixed(digits);
}

function statText(stat: Stat): string {
  return stat.n ? `${fmt(stat.mean)} (n = ${stat.n})` : "–";
}

/** The summary as it is read off into the report. */
export function formatSummary(s: UatSummary): string {
  const out: string[] = [];
  // Printed first and last, so neither end of the output can be pasted into
  // the report without it.
  const banner = s.synthetic
    ? `SAMPLE DATA: ${s.synthetic} rows are marked Synthetic. They were invented to show the format; they are not results and must never be reported.`
    : null;
  if (banner) out.push(banner, "");
  const t = s.testers;
  out.push("Method (Section 5.19)");
  out.push(
    `  ${t.total} ${t.total === 1 ? "tester" : "testers"}: ${t.students} ${t.students === 1 ? "student" : "students"} preparing for interviews, ${t.friendsFamily} friends and family` +
      (t.firstDate ? `, ${t.firstDate} to ${t.lastDate}` : ""),
  );
  out.push(
    `  Devices and browsers: ${t.setups.length ? t.setups.join(", ") : "–"}`,
  );

  out.push("", "Table 5.15  Exit criteria");
  for (const c of s.criteria) {
    const verdict =
      c.met === null ? "not yet measured" : c.met ? "MET" : "NOT MET";
    out.push(`  ${c.name}`);
    out.push(`    pass mark: ${c.passMark}   result: ${c.result}   ${verdict}`);
  }

  const u11 = s.items.find((i) => i.id === "U11")!;
  const u12 = s.items.find((i) => i.id === "U12")!;
  const f = s.functional;
  out.push("", "Table 5.16  Other measures");
  out.push(
    `  Functional cases passed: ${f.passed} of ${f.run} run (${f.inPlan} in the plan, ${f.inPlan - f.run} not run)` +
      (f.failing.length ? `; not passing: ${list(f.failing)}` : ""),
  );
  out.push(
    `  Bugs found (Blocker / Major / Minor / Cosmetic): ${SEVERITIES.map((sev) => s.bugs[sev]).join(" / ")}`,
  );
  out.push(`  U11: ${statText(u11.all)}; students: ${statText(u11.students)}`);
  out.push(`  U12: ${statText(u12.all)}; students: ${statText(u12.students)}`);
  for (const [label, sus] of [
    ["System Usability Scale", s.sus.all],
    ["  students only", s.sus.students],
  ] as const) {
    out.push(
      `  ${label}: ` +
        (sus.n
          ? `${fmt(sus.mean)} (range ${fmt(sus.min)}–${fmt(sus.max)}, n = ${sus.n})`
          : "–"),
    );
  }
  out.push(
    `  Task success without help: ` +
      s.tasks
        .map((task) => `${task.label} ${task.done} of ${task.attempted}`)
        .join(", "),
  );

  out.push("", "Every questionnaire item (all testers; students)");
  for (const item of s.items) {
    out.push(
      `  ${item.id.padEnd(4)} ${statText(item.all)}; ${statText(item.students)}`,
    );
  }
  out.push(
    `  U5   ${Object.entries(s.u5)
      .map(([answer, n]) => `${answer} ${n}`)
      .join(", ")}`,
  );

  if (s.warnings.length) {
    out.push("", `Check these before quoting anything (${s.warnings.length})`);
    for (const w of s.warnings) out.push(`  - ${w}`);
  }
  if (banner) out.push("", banner);
  return out.join("\n");
}
