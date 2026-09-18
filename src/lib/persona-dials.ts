/**
 * What a dial's number means, in the words the interviewer is actually given.
 *
 * A number alone tells a user nothing: "pushback 7" is a fact about a slider,
 * not about an interview. The label says which kind of interviewer the setting
 * produces — Minimal, Light, Moderate, High — so the choice can be made by
 * intent rather than by guesswork.
 *
 * These are the *personality* bands, taken from the adjective the prompt uses,
 * and they are deliberately coarser than the behaviour. A dial resolves 7 to 10
 * of its ten steps (`docs/PERSONA-EVAL.md`), because countable directives sit
 * alongside the adjective — a word budget, a specifics floor, a challenge rung —
 * and those break at different points. So two values sharing a label do **not**
 * behave identically, and nothing here should say they do.
 *
 * Every threshold is the one its consumer already uses, and
 * `persona-dials.test.ts` fails if they drift apart.
 */

export type PersonaDialKey =
  | "strictness"
  | "warmth"
  | "pace"
  | "pushback"
  | "probingDepth"
  | "unpredictability";

export interface DialBand {
  /** One or two words, shown next to the number. */
  label: string;
  /** The lowest value in this band, so a caller can show the whole scale. */
  from: number;
}

/**
 * The bands, highest first — read by taking the first whose `from` the value
 * reaches. Thresholds are copied from the consumer named above each list.
 */
const BANDS: Record<PersonaDialKey, DialBand[]> = {
  // persona-engine.ts buildPersonalityCore
  strictness: [
    { label: "Demanding", from: 8 },
    { label: "Moderate", from: 5 },
    { label: "Flexible", from: 1 },
  ],
  // persona-engine.ts buildPersonalityCore
  warmth: [
    { label: "Warm", from: 8 },
    { label: "Neutral", from: 5 },
    { label: "Reserved", from: 1 },
  ],
  // persona-engine.ts buildPaceProfile
  pace: [
    { label: "Fast", from: 8 },
    { label: "Brisk", from: 6 },
    { label: "Balanced", from: 4 },
    { label: "Deliberate", from: 1 },
  ],
  // persona-engine.ts buildPushbackProfile
  pushback: [
    { label: "High", from: 8 },
    { label: "Moderate", from: 6 },
    { label: "Light", from: 4 },
    { label: "Minimal", from: 1 },
  ],
  // decision-engine.ts probeTierLimit — seven signal tiers, ceil(depth/10 * 7)
  probingDepth: [
    { label: "Every claim", from: 9 },
    { label: "Most claims", from: 6 },
    { label: "Clear gaps", from: 3 },
    { label: "Rarely", from: 1 },
  ],
  // decision-engine.ts curveball chance — (depth/10) * 0.6, before style
  unpredictability: [
    { label: "Frequent", from: 8 },
    { label: "Occasional", from: 5 },
    { label: "Rare", from: 2 },
    { label: "Never", from: 1 },
  ],
};

/** The band a value falls in. Out-of-range values clamp to the nearest band. */
export function describeDial(dial: PersonaDialKey, value: number): DialBand {
  const bands = BANDS[dial];
  return bands.find((band) => value >= band.from) ?? bands[bands.length - 1];
}

/** Every band for one dial, lowest first, for a legend or a test. */
export function dialBands(dial: PersonaDialKey): DialBand[] {
  return [...BANDS[dial]].reverse();
}

/**
 * The range of values sharing a value's label, as "8-10" or "5".
 *
 * A label partition, not a behaviour plateau: the interviewer still changes
 * within a band. Used to check the labels tile 1-10 exactly once.
 */
export function bandRange(dial: PersonaDialKey, value: number): string {
  const band = describeDial(dial, value);
  const above = BANDS[dial]
    .map((candidate) => candidate.from)
    .filter((from) => from > band.from);
  const upper = above.length ? Math.min(...above) - 1 : 10;
  return band.from === upper ? String(band.from) : `${band.from}-${upper}`;
}
