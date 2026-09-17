/**
 * Display formatting shared across the dashboard.
 *
 * Each of these existed two to four times, copy-pasted per page, and they had
 * already begun to drift: the dashboard's relative-date helper grew a "weeks
 * ago" branch that the sessions page's copy never got, so the same timestamp
 * rendered as "3 weeks ago" in one list and a bare locale date in another.
 *
 * That is the specific failure duplication causes in display code — not a bug
 * anyone reports, just quiet inconsistency the user notices and cannot name.
 */

/**
 * A timestamp as a human interval: "Just now", "3 days ago", "2 weeks ago".
 *
 * Falls back to a locale date beyond about a month, where "7 weeks ago" stops
 * being easier to read than the date itself.
 */
export function formatRelativeDate(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";

  const minutes = Math.round((Date.now() - ts) / (1000 * 60));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;

  const weeks = Math.round(days / 7);
  if (weeks < 5) return weeks === 1 ? "1 week ago" : `${weeks} weeks ago`;

  return new Date(ts).toLocaleDateString();
}

/** Absolute date and time, for library rows where "when exactly" is the point. */
export function formatDateTime(iso: string): string {
  const ts = Date.parse(iso);
  if (Number.isNaN(ts)) return "";
  return new Date(ts).toLocaleString();
}

/**
 * Up to two initials from a display name.
 *
 * Takes a bare name rather than a user, so it works for personas and
 * interviewers as well as the account holder.
 */
export function initialsFromName(name: string): string {
  const parts = (name ?? "")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * A token count, rounded to the precision the number deserves.
 *
 * Nobody acts on the last three digits of 23,847, and printing them implies a
 * precision the figure does not have: usage is recorded per call and a single
 * answer moves it by hundreds. Small counts stay exact, because "0" and "840"
 * are meaningfully different when you are looking at one interview.
 */
export function formatTokens(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return "0";
  if (tokens >= 10_000)
    return (Math.round(tokens / 1_000) * 1_000).toLocaleString();
  if (tokens >= 1_000) return (Math.round(tokens / 100) * 100).toLocaleString();
  return Math.round(tokens).toLocaleString();
}

/**
 * A dollar figure at a scale a candidate can read.
 *
 * These are fractions of a cent per call, so two decimal places would print
 * "$0.00" for real spend. Under a dollar keeps three; at or above it, the usual
 * two. Exact zero is zero — only an empty window produces it.
 */
export function formatUsd(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return "$0.00";
  if (amount < 0.001) return "under $0.001";
  if (amount < 1) return `$${amount.toFixed(3)}`;
  return `$${amount.toFixed(2)}`;
}
