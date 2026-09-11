import { MAX_SESSION_TAG_CHARS } from "@/lib/api/input-limits";

/**
 * How a session is named, labelled, sorted and filtered.
 *
 * Client-safe on purpose — no server imports — so the tag editor normalises a
 * tag exactly the way the API will, and the sessions page offers exactly the
 * sorts and filters the API accepts. A rule written twice drifts.
 */

export type SessionSort = "newest" | "oldest" | "score_high" | "score_low";

export const SESSION_SORTS: ReadonlyArray<{ value: SessionSort; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "score_high", label: "Highest score" },
  { value: "score_low", label: "Lowest score" },
];

export function parseSessionSort(value: unknown): SessionSort | undefined {
  return SESSION_SORTS.find((sort) => sort.value === value)?.value;
}

export type ScoreBand = "any" | "strong" | "fair" | "weak";

export const SCORE_BANDS: ReadonlyArray<{
  value: ScoreBand;
  label: string;
  min?: number;
  max?: number;
}> = [
  { value: "any", label: "Any score" },
  { value: "strong", label: "80% and above", min: 80 },
  { value: "fair", label: "60–79%", min: 60, max: 79 },
  { value: "weak", label: "Below 60%", max: 59 },
];

export function parseScoreBand(value: unknown): ScoreBand {
  return SCORE_BANDS.find((band) => band.value === value)?.value ?? "any";
}

export function scoreBandRange(band: ScoreBand): { min?: number; max?: number } {
  const found = SCORE_BANDS.find((entry) => entry.value === band);
  return { min: found?.min, max: found?.max };
}

export type SinceWindow = "any" | "7d" | "30d" | "90d";

export const SINCE_WINDOWS: ReadonlyArray<{
  value: SinceWindow;
  label: string;
  days?: number;
}> = [
  { value: "any", label: "Any time" },
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
];

export function parseSinceWindow(value: unknown): SinceWindow {
  return SINCE_WINDOWS.find((window) => window.value === value)?.value ?? "any";
}

export function sinceToIso(window: SinceWindow, now = Date.now()): string | undefined {
  const days = SINCE_WINDOWS.find((entry) => entry.value === window)?.days;
  return days === undefined
    ? undefined
    : new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Which sessions a list shows by archive state. The API defaults to "all"
 * when nothing is asked for: archiving hides a session from the sessions page,
 * it does not remove it from the stats the dashboard and analytics compute.
 */
export type ArchivedView = "active" | "archived" | "all";

export function parseArchivedView(value: unknown): ArchivedView | undefined {
  return value === "active" || value === "archived" || value === "all"
    ? value
    : undefined;
}

/**
 * One tag, the way it is stored: trimmed, inner whitespace collapsed, a leading
 * "#" dropped (people type it), and capped. Null when nothing is left.
 */
export function normalizeTag(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // Trimmed before the "#" is dropped: " #round 2" kept its hash when the
  // strip ran first, because the leading space hid it.
  const cleaned = raw
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^#+\s*/, "")
    .slice(0, MAX_SESSION_TAG_CHARS)
    .trim();
  return cleaned || null;
}

/**
 * A tag list: each normalised, duplicates removed without regard to case so
 * "Acme" and "acme" cannot both appear. The first spelling wins.
 */
export function normalizeTags(values: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of values) {
    const tag = normalizeTag(value);
    if (!tag) continue;
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }
  return tags;
}

export function addTag(tags: readonly string[], raw: unknown): string[] {
  return normalizeTags([...tags, raw]);
}

export function removeTag(tags: readonly string[], tag: string): string[] {
  const key = tag.toLocaleLowerCase();
  return tags.filter((existing) => existing.toLocaleLowerCase() !== key);
}

/** What to call a session: the candidate's name for it, else the generated one. */
export function displayTitle(session: {
  title?: string | null;
  scenarioTitle: string | null;
  scenarioValue: string;
}): string {
  return (
    session.title?.trim() ||
    session.scenarioTitle?.trim() ||
    session.scenarioValue
  );
}
