/**
 * Thrown when a text edit would pull the ground out from under a live session.
 *
 * Its own type so the route can answer 409 with the count rather than a generic
 * 500 — the user needs to know *why* it refused, and how many interviews they
 * would have to finish or abandon first.
 *
 * One class for both documents because the rule is one rule: the interviewer
 * reads the stored text live on every turn, so editing it mid-interview changes
 * what the candidate is being asked about halfway through, and the report then
 * scores them against a document that no longer exists in that form.
 */
export class DocumentInUseError extends Error {
  constructor(
    readonly inProgress: number,
    noun: "job description" | "resume",
  ) {
    super(
      inProgress === 1
        ? `1 interview is still in progress with this ${noun}.`
        : `${inProgress} interviews are still in progress with this ${noun}.`,
    );
    this.name = "DocumentInUseError";
  }
}
