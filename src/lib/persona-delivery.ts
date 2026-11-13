/**
 * How the interviewer says its next question, written into the private note.
 *
 * Warmth and pushback were the two weakest dials in the live experiment
 * (+0.5 and +0.8 on a ten-point scale, `docs/PERSONA-EVAL.md`), and they were
 * weak for a reason that had already been found once: they lived only in the
 * persona description at the top of the prompt, while the model follows the
 * private note that sits after the candidate's answer. Moving that note took
 * topic changes from 0 in 10 to 10 in 10. This puts the same two dials in the
 * same place.
 *
 * Warmth also had to be separated from praise. Three rules told every persona
 * to sound neutral — the standing "no praise" rule, warmth's own "no praise, no
 * assessment" allowance, and the note's "do not praise it out loud" — so the
 * warmest interviewer was instructed three times not to be warm. Warmth here
 * means friendliness to the *person*: thanking them, putting them at ease,
 * telling them there is no rush. It never means a verdict on the *answer*,
 * which stays forbidden for every persona, because grading out loud is what a
 * real interviewer does not do and what the report is for.
 */

import { contestCount, PUSHBACK_DIRECTIVES } from "@/lib/persona-engine";
import { describeDial } from "@/lib/persona-dials";
import type { InterviewStrategy } from "@/lib/response-analyzer";

export interface DeliveryDials {
  warmth: number;
  pushback: number;
}

export type WarmthBand = "warm" | "neutral" | "reserved";

/** The band the dial's label shows, so the wizard and the note never disagree. */
export function warmthBand(warmth: number): WarmthBand {
  const label = describeDial("warmth", warmth).label;
  return label === "Warm"
    ? "warm"
    : label === "Neutral"
      ? "neutral"
      : "reserved";
}

const DELIVERY: Record<WarmthBand, string> = {
  warm: "- Delivery: warm. Before the question, say one short, friendly thing to the person, such as thanking them or telling them there is no rush. Friendly is not grading: never say whether the answer was good.",
  neutral:
    '- Delivery: even and professional. At most a brief "Okay" or "Thanks" before the question.',
  reserved:
    "- Delivery: reserved and formal. No acknowledgement, no thanks, no softening. Start with the question.",
};

/** What to say when the answer was weak, by how warm the interviewer is. */
export function escalationLine(dials: DeliveryDials): string {
  const band = warmthBand(dials.warmth);
  if (band === "warm") {
    return "- The answer was weak or repeated; push for specifics, kindly: ask for one concrete example and make it easy to give.";
  }
  if (band === "reserved" || contestCount(dials.pushback) >= 3) {
    return "- The answer was weak or repeated; be firmer, push for specifics and say plainly what is missing.";
  }
  return "- The answer was weak or repeated; be firmer and push for specifics.";
}

/**
 * Moves that stay on the answer just given, where contesting a claim fits.
 *
 * Left out: the two curveballs, which open something new and would stack a
 * second question on the first, and clarifying the situation, where there is
 * not yet a story to doubt.
 */
const CHALLENGE_FITS: ReadonlySet<InterviewStrategy> = new Set([
  "PROBE_ACTION",
  "CHALLENGE_OWNERSHIP",
  "EXPLORE_RESULT",
  "ACKNOWLEDGE_STRENGTH",
  "DRILL_SPECIFICITY",
  "ASSESS_THINKING",
]);

/**
 * The lines the note gains from the persona: always the delivery, and the
 * challenge rung when pushback is high enough to need repeating where it will
 * be read. Low pushback is not repeated here on purpose: "take their account
 * at face value" in the note would fight a weakness-driven move such as
 * drilling for specifics, which by design outranks the persona.
 */
export function deliveryLines(
  dials: DeliveryDials,
  strategy: InterviewStrategy,
): string[] {
  const lines = [DELIVERY[warmthBand(dials.warmth)]];
  const rung = contestCount(dials.pushback);
  if (rung >= 3 && CHALLENGE_FITS.has(strategy)) {
    lines.push(`- Challenge: ${PUSHBACK_DIRECTIVES[rung]}`);
  }
  return lines;
}
