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
