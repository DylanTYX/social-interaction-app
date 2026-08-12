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

/** How long a pause has to run before the turn is submitted. */
export const SILENCE_SUBMIT_MS = 3000;

/**
 * When the countdown becomes visible. Early enough that submission is never a
 * surprise, late enough that an ordinary between-sentence breath does not make
 * the UI flicker.
 */
export const SILENCE_WARN_AT_MS = 1500;

export type SilenceDecision =
  /** Still talking, or not yet talking. Nothing to show. */
  | { kind: "listening" }
  /** Quiet, and close enough to the threshold to warn about it. */
  | { kind: "warning"; msRemaining: number }
  /** Quiet for long enough. Submit the turn. */
  | { kind: "submit" };

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
  submitAfterMs?: number;
  warnAfterMs?: number;
}): SilenceDecision {
  const submitAfter = input.submitAfterMs ?? SILENCE_SUBMIT_MS;
  const warnAfter = input.warnAfterMs ?? SILENCE_WARN_AT_MS;

  if (!input.hasSpoken || input.lastSpeechAtMs === null) {
    return { kind: "listening" };
  }

  const quietFor = input.nowMs - input.lastSpeechAtMs;

  if (quietFor >= submitAfter) {
    return { kind: "submit" };
  }

  if (quietFor >= warnAfter) {
    return { kind: "warning", msRemaining: submitAfter - quietFor };
  }

  return { kind: "listening" };
}
