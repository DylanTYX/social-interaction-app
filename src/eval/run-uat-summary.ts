/**
 * The user acceptance test results, as the report quotes them.
 *
 *   npm run uat-summary              # the real logs, in docs/
 *   npm run uat-summary -- --sample  # the practice logs (invented rows)
 *
 * Reads `docs/UAT.md` for the list of cases and the three logs beside it —
 * `UAT-testers.csv`, `UAT-case-log.csv`, `UAT-bug-log.csv` — and prints the
 * method line, Table 5.15 (exit criteria with their verdicts) and Table 5.16.
 * The rules it applies are in `uat-summary.ts`; how to fill the logs is in
 * the plan, Section 6. Offline, and writes nothing.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  formatSummary,
  parseCsv,
  readPlanCases,
  summarise,
} from "@/eval/uat-summary";

const DOCS = join(process.cwd(), "docs");
// Kept out of docs/ itself, so the real logs are never the invented ones.
const SAMPLE = join(DOCS, "artifacts", "uat-sample");
const LOGS = process.argv.includes("--sample") ? SAMPLE : DOCS;

function readCsv(name: string) {
  const path = join(LOGS, name);
  if (!existsSync(path)) {
    console.warn(`${path} is missing; read as empty.`);
    return [];
  }
  return parseCsv(readFileSync(path, "utf8"));
}

const plan = readPlanCases(readFileSync(join(DOCS, "UAT.md"), "utf8"));
const summary = summarise({
  plan,
  testers: readCsv("UAT-testers.csv"),
  cases: readCsv("UAT-case-log.csv"),
  bugs: readCsv("UAT-bug-log.csv"),
});

console.log(formatSummary(summary));
