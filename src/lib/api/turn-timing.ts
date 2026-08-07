/**
 * Where a turn's wall-clock actually goes.
 *
 * A chat turn fans out to several model calls, and until now none of them were
 * timed — so "the AI takes a while to reply" could only be answered by reading
 * the code and guessing which `await` dominated. Structurally the scoring call
 * blocks the interviewer stream; whether it *dominates* is a measurement, and
 * this is the measurement.
 *
 * Deliberately in-process and log-only. It records no user content, writes
 * nothing to the database, and never throws — instrumentation must not be able
 * to fail a turn that would otherwise have succeeded.
 */

export type TurnStage =
  | "retrieval"
  | "analysis"
  | "interviewer_ttft"
  | "interviewer_total"
  | "persist"
  | "summary"
  | "coverage";

type Mark = { stage: TurnStage; ms: number; blocking: boolean };

export class TurnTimer {
  private readonly startedAt = Date.now();
  private readonly marks: Mark[] = [];

  /**
   * Time an awaited stage. `blocking` marks the ones that sit between the
   * candidate pressing send and the first token reaching them — the only ones
   * they can actually feel.
   */
  async time<T>(
    stage: TurnStage,
    blocking: boolean,
    run: () => Promise<T>,
  ): Promise<T> {
    const from = Date.now();
    try {
      return await run();
    } finally {
      this.marks.push({ stage, ms: Date.now() - from, blocking });
    }
  }

  /** Record a moment rather than a span — time-to-first-token, mostly. */
  markSince(stage: TurnStage, from: number, blocking = true): void {
    this.marks.push({ stage, ms: Date.now() - from, blocking });
  }

  /** Milliseconds the candidate waited before anything appeared. */
  blockingMs(): number {
    return this.marks
      .filter((mark) => mark.blocking)
      .reduce((total, mark) => total + mark.ms, 0);
  }

  all(): readonly Mark[] {
    return this.marks;
  }

  /**
   * One line per turn, so a slow session can be read straight out of the server
   * log without correlating anything.
   */
  log(context: { sessionId: string; roundType?: string | null }): void {
    if (this.marks.length === 0) return;

    const breakdown = this.marks
      .map((mark) => `${mark.stage}=${mark.ms}ms${mark.blocking ? "*" : ""}`)
      .join(" ");

    console.info(
      `[turn-timing] session=${context.sessionId} round=${
        context.roundType ?? "-"
      } blocking=${this.blockingMs()}ms total=${
        Date.now() - this.startedAt
      }ms ${breakdown} (* = before first token)`,
    );
  }
}
