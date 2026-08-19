import type { InterviewRoundType } from "@/lib/interview-rounds";

/**
 * What the coach is told "good" looks like, per round type.
 *
 * Before this existed, `rubricGuidance` in the coach route had **two branches**
 * for six round types: one sentence for anything `isTechnicalRound`, and a
 * hardcoded STAR sentence for everything else. So a screening answer about
 * motivation and an HR answer about notice periods were both coached as if they
 * were behavioural STAR stories, and `technical_swe`, `system_design` and `case`
 * shared a single sentence that differed only by an interpolated label.
 *
 * The analyzer never had this problem — it interpolates
 * `ROUND_TYPE_SPECS[type].rubric` and anchors against five explicit score bands.
 * The coach was the one LLM call in the app graded against nothing.
 *
 * ---
 *
 * **Why its own module rather than a field on `RoundTypeSpec`.**
 *
 * `round-types.ts` is imported by client components for `icon`, `accent` and
 * `label` — the setup wizard's type picker, the report header. Hanging ~1.5KB of
 * coaching prose per round type off `RoundTypeSpec` would ship all of it to the
 * browser on every page that renders a round-type chip, to be used by exactly
 * one server route. A `Record<InterviewRoundType, …>` here gives the identical
 * compile-time guarantee that file's docstring argues for — *"a `Record` over
 * `InterviewRoundType` makes an incomplete entry a compile error"* — without the
 * bundle cost. `ROUND_RUBRIC_LABELS` in `interview-rounds.ts` is the same split.
 *
 * **The criteria themselves are never re-typed here.** `signals` says what a
 * strong answer *contains*; the list of things being scored comes from
 * `ROUND_TYPE_SPECS[type].rubric` at prompt-build time. If the two were both
 * hand-written they would drift, and the coach would optimise for a rubric the
 * analyzer no longer uses.
 */
export interface CoachRubric {
  /** The structural template a strong answer of this type follows. */
  shape: string;
  /**
   * What a strong answer demonstrates.
   *
   * Must jointly cover every criterion in `ROUND_TYPE_SPECS[type].rubric` —
   * asserted in `coach-prompt.test.ts`, so a new round type cannot ship with a
   * rubric the coach silently ignores.
   */
  signals: string[];
  /**
   * How answers of this type characteristically fail.
   *
   * The prompt instructs the model to name the ones actually present rather
   * than giving advice that would fit any answer, which is what "tips" degrade
   * into without this.
   */
  failureModes: string[];
  /** What the invented `suggestedAnswer` has to demonstrate to stay on-rubric. */
  exemplar: string;
}

export const COACH_RUBRICS: Record<InterviewRoundType, CoachRubric> = {
  screening: {
    shape:
      "Two beats: where they are now and what they have done, then the specific reason this role is the next step.",
    signals: [
      "names something concrete about this company or role — a product, a decision, a post — not a generic compliment",
      "connects one strand of their own experience to what the role actually demands, rather than listing all of it",
      "stays inside roughly ninety seconds; a screening answer is a trailer, not the film",
      "ends somewhere deliberate, ideally on something they want to know back",
    ],
    failureModes: [
      "an answer that would work word-for-word at any other employer",
      "a chronological read-out of the resume, oldest job first",
      "enthusiasm standing in for a reason — 'I'm really passionate about this space'",
      "trailing off rather than landing",
    ],
    exemplar:
      "A ninety-second answer that a recruiter could repeat back accurately after hearing it once.",
  },

  behavioral: {
    shape:
      "Situation, Task, Action, Result — one incident, told in the first person.",
    signals: [
      "a situation with a time and a place, not a category of situation",
      "'I' rather than 'we' on the actions that mattered, so the ownership is legible",
      "a result with a number, a date or a decision attached to it",
      "what it cost, what was traded away, or what they would do differently",
    ],
    failureModes: [
      "'we' throughout, leaving no way to tell what the candidate personally did",
      "general philosophy about teamwork instead of one specific incident",
      "the story stopping at the action, with the result never stated",
      "a result that is unquantified — 'it went really well', 'the client was happy'",
    ],
    exemplar:
      "One incident, fully closed out, where the candidate's own decisions are the reason the result happened.",
  },

  hr: {
    shape:
      "Priorities in rank order, then logistics answered plainly, then a question only this company could be asked.",
    signals: [
      "ranks what they want rather than listing it, so the trade-offs are visible",
      "gives a real range on compensation and a real date on notice, rather than deflecting",
      "evidences a value from something they actually did, instead of naming it as an adjective",
      "closes with a question that shows they have thought about this specific company",
    ],
    failureModes: [
      "'I'm flexible' as an answer to a logistics question, which reads as unprepared rather than easy-going",
      "values as adjectives — 'collaborative', 'growth-minded' — with nothing behind them",
      "'no questions from me', which is the most expensive sentence in an HR round",
      "an answer about what they want that never says what they would give up",
    ],
    exemplar:
      "An answer that makes the candidate easy to place: clear on priorities, unambiguous on logistics, specific about this employer.",
  },

  technical_swe: {
    shape:
      "Restate and constrain the problem, state the approach and why, then the code, then complexity, then edge cases.",
    signals: [
      "states time and space complexity, both, and correctly",
      "handles the edge cases the problem implies — empty input, duplicates, overflow, the boundary",
      "justifies the data structure against the alternative it beat, rather than asserting it",
      "names things readably and structures the code so it can be read once",
    ],
    failureModes: [
      "code delivered with no narration, so the reasoning is invisible",
      "a brute-force solution offered without acknowledging that it is one",
      "complexity stated confidently and wrongly",
      "no edge cases considered at all",
    ],
    exemplar:
      "A solution where the reasoning arrives before the code and the complexity claim survives checking.",
  },

  system_design: {
    shape:
      "Requirements and scale first, then architecture, then the tradeoff being made and what it costs.",
    signals: [
      "quantified requirements before any component is named — reads, writes, latency, growth",
      "a capacity estimate that goes on to constrain a later choice, rather than sitting unused",
      "each component justified against the alternative it displaced",
      "names explicitly what the design gives up, and under what conditions it breaks",
    ],
    failureModes: [
      "naming components without saying what problem each one solves",
      "'scalable and highly available' asserted rather than derived",
      "no numbers anywhere, so every choice is unfalsifiable",
      "no tradeoff acknowledged, which means no design decision was actually made",
    ],
    exemplar:
      "A design whose numbers come first and whose weakest point the candidate names before the interviewer does.",
  },

  /**
   * The rubric that exists because nothing else described a *definition*.
   *
   * `technical_swe` asks for approach, then code, then complexity, then edge
   * cases. Applied to "what are the four conditions for deadlock?" it marks an
   * answer for complexity analysis it cannot have, and the tips come back
   * generic. This is the shape a concept answer actually has.
   *
   * Carries eight drill topics — OOP, databases, operating systems, networks,
   * security, AI/ML, cloud and web. Different subject matter, one marking
   * standard, which is the correct relationship between a topic and a rubric.
   */
  cs_fundamentals: {
    shape:
      "Define the concept precisely, contrast it with the one it is most often confused with, then give a concrete case where the difference changed a decision.",
    signals: [
      "a definition that states the mechanism rather than restating the name",
      "names the alternative it is being contrasted with, and when that one wins instead",
      "grounds it in something they actually built, debugged or measured",
      "states the cost of the choice, not only its benefit",
    ],
    failureModes: [
      "a memorised textbook definition with no example attached to it",
      "stated confidently and wrongly, which is worse here than hedging",
      "'faster' or 'more scalable' asserted with no mechanism behind it",
      "cannot say when the alternative would be the better choice",
    ],
    exemplar:
      "An answer where the definition is precise, the contrast is explicit, and the example proves they have met the concept outside a textbook.",
  },
};
