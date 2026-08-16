/**
 * What to say when a document was too long to store whole.
 *
 * Shared by CVs and job descriptions, because the answer to "your document was
 * shortened" should not depend on which document it was. Only two things vary:
 * the noun, and whether there is a cheaper fix available than editing by hand.
 *
 * Both used to *refuse* an over-length upload. Refusing capped the stored text
 * at exactly the same place truncating does, so it prevented nothing extra —
 * it only stopped the user, and on the CV side the person it stopped was the
 * one with a six-page CV who had done nothing wrong.
 *
 * The wording is built around three things a bare "too long" leaves out:
 * the real numbers, so you can judge whether you care rather than guess; a page
 * count, because characters are hard to picture; and the fact that *you* choose
 * what to cut. That last one is the point. If a document has to be shortened,
 * its author should decide what goes — the same principle that removed the
 * model-written CV summary.
 */

export type TruncatedDocumentKind = "resume" | "jobDescription";

/** Roughly what a page of extracted PDF text runs to, at the dense end. */
const CHARS_PER_PAGE = 4_000;

const NOUN: Record<TruncatedDocumentKind, string> = {
  resume: "CV",
  jobDescription: "job description",
};

/**
 * A job description has an action a CV does not: most over-length pastes are
 * mostly page furniture, and the tidy-up strips it. A CV is already all
 * content, so the only honest advice is to trim it yourself.
 */
const ADVICE: Record<TruncatedDocumentKind, string> = {
  resume:
    "If the experience you most want to be asked about is further down, trim the CV yourself and upload again so those parts are the ones that survive.",
  jobDescription:
    "Most over-length pastes are mostly page furniture — Tidy this up strips the navigation and boilerplate, which usually brings it under on its own.",
};

/**
 * The notice shown once at upload. `kept` and `original` are character counts;
 * returns null when nothing was dropped, so callers can use it as the condition
 * as well as the message.
 */
export function describeTruncation(input: {
  kind: TruncatedDocumentKind;
  kept: number;
  original: number;
}): string | null {
  if (input.original <= input.kept) return null;

  const pages = Math.round(input.kept / CHARS_PER_PAGE);
  return (
    `Saved, but shortened. Your ${NOUN[input.kind]} is ${input.original.toLocaleString()} characters; ` +
    `we've kept the first ${input.kept.toLocaleString()} — about ${pages} pages. ` +
    `The rest won't reach the interviewer. ${ADVICE[input.kind]}`
  );
}

/**
 * The persistent version, for a library row or a preview header long after the
 * upload notice has gone. Deliberately terser: it sits beside other metadata
 * rather than interrupting, and the full explanation was already given once.
 */
export function describeTruncationBadge(
  truncatedFrom: number | null | undefined,
): string | null {
  if (!truncatedFrom) return null;
  return `Shortened from ${truncatedFrom.toLocaleString()} characters`;
}
