/**
 * Deciding when the candidate has finished speaking.
 *
 * Until now the only thing that ended a voice turn was clicking "stop" — so the
 * app listened indefinitely to someone who had already finished, and the
 * interview felt like a walkie-talkie rather than a conversation. Azure's own
 * `Segmentation_SilenceTimeoutMs` is the obvious lever and the wrong one: it
 * caps at 5s, and it governs *phrase* segmentation, not turn end. Doing it here
 * keeps the threshold tunable and, more importantly, observable — the candidate
 * can watch the countdown rather than being cut off by something invisible.
 *
 * Pure on purpose. The wiring in the voice screen is a `setInterval` and some
 * refs, none of which is worth testing; this is the part with the actual rules
 * in it.
 */

/**
 * How long a pause has to run before the turn is submitted.
 *
 * Raised from 3 s. Three seconds is inside the range a candidate spends
 * thinking mid-answer, so the app ended turns on exactly the pauses it says
 * elsewhere are fine — scoring never penalised them, but the interaction did.
 * Four seconds still keeps the conversation moving, and the countdown below
 * makes the deadline visible rather than surprising.
 */
export const SILENCE_SUBMIT_MS = 4000;

/**
 * When the countdown becomes visible. Early enough that submission is never a
 * surprise, late enough that an ordinary between-sentence breath does not make
 * the UI flicker.
 */
export const SILENCE_WARN_AT_MS = 2000;

/**
 * How long total silence runs before the interviewer checks in.
 *
 * A separate rule from the one above, because the two silences are different
 * events. A pause *inside* an answer is thinking, and the product's position is
 * that thinking is never penalised. A candidate who has not said a single word
 * is not thinking out loud — they may not have heard the question, the
 * microphone may be dead, or they may be lost, and a real interviewer notices
 * within about half a minute rather than waiting three.
 *
 * Three minutes is what this used to be, by accident: the *answer length* cap
 * was doing double duty as the never-spoke fallback, and nobody had separated
 * them. Three minutes of dead air is not an interview, it is a stuck page.
 *
 * Twenty-five seconds is a judgement, not a measurement, and is deliberately
 * generous: wait-time research (Rowe 1986) finds answers improve when a
 * questioner waits several seconds, so the cost of waiting a little too long is
 * much lower than the cost of interrupting someone composing an answer.
 */
export const OPENING_SILENCE_PROMPT_MS = 10_000;

/**
 * When the check-in becomes visible.
 *
 * Six seconds of visible countdown: long enough to start talking and cancel it,
 * short enough that it is not a stare. The first draft waited fifteen seconds
 * before showing anything, which is longer than the silence a person would sit
 * through before wondering whether the microphone was working at all.
 */
export const OPENING_SILENCE_WARN_AT_MS = 4_000;

export type SilenceDecision =
  /** Still talking, or not yet talking. Nothing to show. */
  | { kind: "listening" }
  /**
   * Quiet, and close enough to the threshold to warn about it.
   *
   * Carries the deadline as well as the remaining time, because the countdown
   * on screen has two different deadlines to render — four seconds after the
   * last word mid-answer, ten seconds after the microphone opened if nothing
   * has been said — and it used to assume the first. It therefore rendered the
   * opening countdown as a permanent "Submitting in 1s…", which is both wrong
   * and alarming.
   */
  | {
      kind: "warning";
      msRemaining: number;
      deadlineAtMs: number;
      /** What happens at the deadline. */
      pending: "submit" | "prompt";
    }
  /** Quiet for long enough. Submit the turn. */
  | { kind: "submit" }
  /** Nothing said at all for long enough. The interviewer should check in. */
  | { kind: "prompt" };

export function decideSilence(input: {
  /** Wall-clock now, injected so this stays pure. */
  nowMs: number;
  /** Last time any speech was recognised, interim or final. */
  lastSpeechAtMs: number | null;
  /**
   * Whether anything has actually been transcribed this turn.
   *
   * The gate that matters. Without it, a candidate who takes four seconds to
   * gather their thoughts before saying a word would have an empty answer
   * submitted out from under them the moment the mic opened. Initial silence is
   * the response timer's job, not this one's — it expires at three minutes and
   * submits a "no response", which is a real outcome rather than an accident.
   */
  hasSpoken: boolean;
  /**
   * When the microphone opened for this turn. Only used before the candidate
   * has said anything; once they have, the clock that matters is the one since
   * their last word.
   */
  turnStartedAtMs?: number | null;
  submitAfterMs?: number;
  warnAfterMs?: number;
  promptAfterMs?: number;
  promptWarnAfterMs?: number;
}): SilenceDecision {
  const submitAfter = input.submitAfterMs ?? SILENCE_SUBMIT_MS;
  const warnAfter = input.warnAfterMs ?? SILENCE_WARN_AT_MS;
  const promptAfter = input.promptAfterMs ?? OPENING_SILENCE_PROMPT_MS;
  const promptWarnAfter = input.promptWarnAfterMs ?? OPENING_SILENCE_WARN_AT_MS;

  if (!input.hasSpoken || input.lastSpeechAtMs === null) {
    // Nothing said yet. Wait, visibly, and then have the interviewer ask again
    // rather than leaving the candidate in silence until the answer cap.
    if (input.turnStartedAtMs == null) return { kind: "listening" };

    const silentFor = input.nowMs - input.turnStartedAtMs;
    if (silentFor >= promptAfter) return { kind: "prompt" };
    if (silentFor >= promptWarnAfter) {
      return {
        kind: "warning",
        msRemaining: promptAfter - silentFor,
        deadlineAtMs: input.turnStartedAtMs + promptAfter,
        pending: "prompt",
      };
    }
    return { kind: "listening" };
  }

  const quietFor = input.nowMs - input.lastSpeechAtMs;

  if (quietFor >= submitAfter) {
    return { kind: "submit" };
  }

  if (quietFor >= warnAfter) {
    return {
      kind: "warning",
      msRemaining: submitAfter - quietFor,
      deadlineAtMs: input.lastSpeechAtMs + submitAfter,
      pending: "submit",
    };
  }

  return { kind: "listening" };
}
