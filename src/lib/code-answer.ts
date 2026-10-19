/**
 * Code answers travel through the same `userMessage` string as prose answers,
 * fenced with the language tag. That keeps the whole persistence path — the
 * append RPC, `interview_messages`, the transcript, the rolling summary —
 * unchanged, and means the analyzer receives the language without needing a
 * parallel field threaded through every layer.
 */

export const CODE_LANGUAGES = [
  { id: "python", label: "Python" },
  { id: "javascript", label: "JavaScript" },
  { id: "typescript", label: "TypeScript" },
  { id: "java", label: "Java" },
  { id: "sql", label: "SQL" },
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number]["id"];

export const DEFAULT_CODE_LANGUAGE: CodeLanguage = "python";

/**
 * How long one code answer may run, in either interview mode.
 *
 * Code answers used to share the prose limit — five minutes typed, three in a
 * voice interview — and when it ran out the half-written function was sent.
 * Five minutes is a sentence or two of prose; it is not enough to write, test
 * by hand and tidy a solution, which in a real interview takes most of the
 * round. Twenty minutes is most of a 25-minute technical round, the type's own
 * default length, and the clock is a ceiling rather than a pace: running out
 * sends the code with a note, and the interviewer asks where it got to
 * (`CODE_TIME_UP_NOTE`).
 */
export const CODE_ANSWER_TIME_LIMIT_SECONDS = 20 * 60;

export function isCodeLanguage(value: string): value is CodeLanguage {
  return CODE_LANGUAGES.some((l) => l.id === value);
}

/** Wrap source in a fenced block, optionally with a note written alongside. */
export function formatCodeAnswer(
  code: string,
  language: CodeLanguage,
  note?: string,
): string {
  const body = `\`\`\`${language}\n${code.trimEnd()}\n\`\`\``;
  const trimmedNote = note?.trim();
  return trimmedNote ? `${trimmedNote}\n\n${body}` : body;
}

export interface ParsedCodeAnswer {
  language: CodeLanguage | null;
  code: string;
  /** Prose written outside the fence, if any. */
  note: string;
}

/**
 * Pull the fenced block back out. Returns null when the message is not a code
 * answer, so prose turns are unaffected.
 */
export function parseCodeAnswer(message: string): ParsedCodeAnswer | null {
  const match = message.match(/```([a-zA-Z]*)\n([\s\S]*?)```/);
  if (!match) return null;

  const [, rawLanguage, code] = match;
  const start = match.index ?? 0;
  // Join with a blank line, not by concatenation — a candidate who writes above
  // *and* below the fence would otherwise get "my approachthe complexity is O(n)".
  const note = [message.slice(0, start), message.slice(start + match[0].length)]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");

  return {
    language: isCodeLanguage(rawLanguage) ? rawLanguage : null,
    code: code.replace(/\n$/, ""),
    note,
  };
}

/** Rough line/char counts for the "N lines" affordance under the editor. */
export function describeCode(code: string): string {
  const lines = code.split("\n").filter((l) => l.trim()).length;
  return `${lines} line${lines === 1 ? "" : "s"}`;
}
