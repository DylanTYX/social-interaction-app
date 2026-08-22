import { isTechnicalRound } from "./round-types";
import type {
  AnalysisResult,
  InterviewStrategy,
  STARAnalysis,
  TechnicalScores,
} from "./response-analyzer";
import type { BehavioralSignalType } from "./text-metrics";

export interface DecisionContext {
  personaName: string;
  previousStrategy?: InterviewStrategy;
  responseCount?: number;
  strictness?: number;
  warmth?: number;
  /**
   * Skepticism / challenge intensity (1-10). Long a prompt-prose field only;
   * its first numeric consumer is `maybeCurveball`, where high pushback tilts
   * the curveball toward a hypothetical twist over a topic pivot.
   */
  pushback?: number;
  /**
   * Curveball frequency (1-10). The dial behind pointer 2 of
   * docs/INTERVIEWER.md — the professor's "element of surprise", backed by his
   * requirement verbatim. 1 disables curveballs outright.
   */
  unpredictability?: number;
  /**
   * Layer 3 archetype, as move-policy weights. The same field renders a prompt
   * paragraph in `generatePersonaPrompt`; here it biases which moves fire.
   */
  questioningStyle?: string;
  /**
   * Deterministic seed inputs, normally sessionId and turnIndex. Optional so
   * callers without a session (evals, tests) can pass fixed values; when
   * absent, curveballs simply never fire, which is the safe default.
   */
  seed?: { sessionId: string; turnIndex: number };
  /**
   * The highest-value competency the round has not yet covered, phrased as a
   * probe. Gives PIVOT_TOPIC somewhere concrete to land; without it the pivot
   * falls back to "a different aspect of the round".
   */
  uncoveredCompetency?: string | null;
  /**
   * How aggressively evidence-gap signals convert into probes (1-10).
   *
   * The dial behind pointer 1 of docs/INTERVIEWER.md: at 1 only the
   * highest-priority gaps get probed, at 10 everything does. Backed by the
   * probing-depth attribute, Amazon's "Dive Deep", and the arXiv 2608.10412
   * finding that default LLM interviewers issue deepening probes on only 4.9%
   * of turns — probe frequency is the documented gap this dial controls.
   */
  probingDepth?: number;
}

export interface DecisionOutcome {
  strategy: InterviewStrategy;
  reason: string;
  confidence: number;
  shouldEscalate: boolean;
  shouldSlowDown: boolean;
  nextFocus: string;
}

/** Rounds judged on the technical rubric rather than STAR. */

/**
 * The analyzer's JSON is model-generated and not schema-validated, so any
 * individual field can come back missing or non-numeric. Coerce to a neutral
 * mid-scale value rather than letting `undefined` poison the arithmetic — an
 * absent field should not read as a score of zero.
 */
function score(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 5;
}

function averageStar(star: STARAnalysis): number {
  return (
    (score(star?.situation?.quality) +
      score(star?.task?.quality) +
      score(star?.action?.quality) +
      score(star?.result?.quality)) /
    4
  );
}

function averageTechnical(scores: TechnicalScores): number {
  return (
    (score(scores.problemFraming) +
      score(scores.approach) +
      score(scores.correctness) +
      score(scores.complexity) +
      score(scores.communication) +
      score(scores.edgeCases) +
      score(scores.codeQuality)) /
    7
  );
}

/**
 * Which rubric governs this answer.
 *
 * Prefer the presence of `technicalScores`, falling back to the round type so a
 * technical round whose analyzer response omitted the block is still not judged
 * on STAR.
 */
function usesTechnicalRubric(analysis: AnalysisResult): boolean {
  if (analysis.technicalScores) return true;
  return isTechnicalRound(analysis.roundType);
}

function getVaguenessWeight(analysis: AnalysisResult): number {
  const baseVagueness = score(analysis.specificityMetrics?.vaguenessScore);
  const lowConfidencePenalty =
    10 - score(analysis.confidenceIndicators?.assertivenessScore);

  // On a technical round the analyzer is instructed to emit a *zeroed* STAR
  // block, because STAR is not the rubric in play. Scoring that block added a
  // flat +5 penalty to every technical answer and pushed `shouldEscalate` over
  // its threshold almost every turn. Weigh whichever rubric actually applies.
  const rubricPenalty = usesTechnicalRubric(analysis)
    ? 10 -
      Math.round(
        analysis.technicalScores
          ? averageTechnical(analysis.technicalScores)
          : 5,
      )
    : 10 - Math.round(averageStar(analysis.starAnalysis));

  return baseVagueness + lowConfidencePenalty / 2 + rubricPenalty / 2;
}

/**
 * Behavioural / screening rounds: walk the STAR elements in dependency order.
 */
function chooseBehavioralStrategy(analysis: AnalysisResult): InterviewStrategy {
  // Optional chaining throughout, matching `averageStar` above, which has
  // always used `star?.situation?.quality`. `analyzeResponse` now guarantees a
  // complete block, but this also runs against analyses stored *before* that
  // guarantee existed — and a TypeError here is swallowed by the chat route,
  // so the failure mode is a turn that silently loses its score.
  const { starAnalysis, specificityMetrics } = analysis;

  if (!starAnalysis?.situation?.present || !starAnalysis?.task?.present) {
    return "CLARIFY_SITUATION";
  }

  if ((starAnalysis?.action?.specificity ?? 0) < 4) {
    return "DRILL_SPECIFICITY";
  }

  if ((starAnalysis?.action?.ownership ?? 0) < 5) {
    return "CHALLENGE_OWNERSHIP";
  }

  if (!starAnalysis?.result?.present || !starAnalysis?.result?.quantified) {
    return "EXPLORE_RESULT";
  }

  if ((specificityMetrics?.vaguenessScore ?? 5) > 6) {
    return "DRILL_SPECIFICITY";
  }

  if (analysis.overallScore > 75) {
    return "ACKNOWLEDGE_STRENGTH";
  }

  return "PROBE_ACTION";
}

/**
 * Technical / system-design / case rounds.
 *
 * Mirrors the behavioural ladder but over the technical rubric, in the order a
 * real interviewer would unblock: did they understand the problem, can they
 * articulate an approach, is it correct, do they know its cost and failure
 * modes, and did they own the design decisions.
 *
 * This path did not exist before: `chooseStrategy` read only `starAnalysis`,
 * which the analyzer zeroes out on technical rounds, so `situation.present`
 * was always false and every technical turn returned CLARIFY_SITUATION — the
 * interviewer opened each system-design question with "tell me about the
 * situation and task".
 */
function chooseTechnicalStrategy(analysis: AnalysisResult): InterviewStrategy {
  const t = analysis.technicalScores;

  // No technical block despite a technical round: fall through on overall
  // score rather than inventing sub-scores.
  if (!t) {
    return analysis.overallScore > 75 ? "ACKNOWLEDGE_STRENGTH" : "PROBE_ACTION";
  }

  // Everything downstream is meaningless if they misread the problem.
  if (score(t.problemFraming) < 5) {
    return "CLARIFY_SITUATION";
  }

  // Reasoning made visible is the thing under assessment here.
  if (score(t.approach) < 5 || score(t.communication) < 4) {
    return "ASSESS_THINKING";
  }

  if (score(t.correctness) < 5) {
    return "PROBE_ACTION";
  }

  // Cost and failure modes — the usual gap between a working answer and a
  // senior one.
  if (score(t.complexity) < 5 || score(t.edgeCases) < 5) {
    return "DRILL_SPECIFICITY";
  }

  // A recited pattern scores well until you ask why they chose it.
  if (score(t.codeQuality) < 5) {
    return "CHALLENGE_OWNERSHIP";
  }

  if (analysis.overallScore > 75) {
    return "ACKNOWLEDGE_STRENGTH";
  }

  return "PROBE_ACTION";
}

function chooseStrategy(analysis: AnalysisResult): InterviewStrategy {
  return usesTechnicalRubric(analysis)
    ? chooseTechnicalStrategy(analysis)
    : chooseBehavioralStrategy(analysis);
}

/**
 * The reason is not just for display — `buildSteeringBlock` injects it verbatim
 * into the interviewer's prompt as "Recommended approach: X — <reason>". So it
 * has to describe the rubric actually in play; telling the model to "ask for
 * the situation and task" on a system-design question is what produced the
 * behaviour this fix removes.
 */
const REASONS: Record<
  "behavioral" | "technical",
  Record<InterviewStrategy, string>
> = {
  behavioral: {
    CLARIFY_SITUATION:
      "Key context is missing, so ask for the situation and task first.",
    DRILL_SPECIFICITY: "The answer is too vague, so ask for concrete details.",
    CHALLENGE_OWNERSHIP:
      "Ownership looks weak, so push on the candidate's personal role.",
    EXPLORE_RESULT:
      "The result is not clear or quantified, so probe for impact.",
    ACKNOWLEDGE_STRENGTH:
      "The response is strong, so acknowledge it and push deeper.",
    PROBE_ACTION:
      "The answer is usable, but the action details need more depth.",
    ASSESS_THINKING:
      "The reasoning is not visible, so ask them to think out loud.",
    PIVOT_TOPIC:
      "This thread has given what it will give, so change direction — ask about a different competency the round has not touched yet.",
    HYPOTHETICAL_TWIST:
      "The story is solid, so twist it — ask what they would have done if their approach had not worked, or if a key constraint had been different.",
  },
  technical: {
    CLARIFY_SITUATION:
      "The problem has been mis-framed, so pin down requirements and constraints before anything else.",
    DRILL_SPECIFICITY:
      "Complexity and edge cases are unaddressed, so ask what it costs and where it breaks.",
    CHALLENGE_OWNERSHIP:
      "The design reads as a recited pattern, so ask why they chose it over the alternatives.",
    EXPLORE_RESULT:
      "The outcome is unclear, so ask what the solution actually achieves and how they would measure it.",
    ACKNOWLEDGE_STRENGTH:
      "The solution is strong, so acknowledge it and raise the difficulty — scale it up or add a constraint.",
    PROBE_ACTION:
      "The approach is sound but the solution is incomplete, so probe the implementation.",
    ASSESS_THINKING:
      "The approach is unclear, so make them reason out loud through their thinking.",
    PIVOT_TOPIC:
      "This problem has given what it will give, so change direction — open a different aspect of the system the round has not touched yet.",
    HYPOTHETICAL_TWIST:
      "The solution works as stated, so change one constraint — ten times the load, a dependency goes down, the budget halves — and ask what breaks first.",
  },
};

/* ------------------------------------------------------------------------- *
 * Evidence probing — the policy half of the behavioral signal taxonomy.
 *
 * `detectBehavioralSignals` (text-metrics.ts) finds the phrases; this maps
 * each signal to the ladder move that answers it and to a probe sentence that
 * quotes the candidate's exact word. The sentence travels through the
 * existing `reason` channel, which `buildSteeringBlock` already interpolates
 * into the interviewer's prompt verbatim — so a marker reaching the model is
 * safe only because markers are matched against fixed phrase alternatives:
 * the lexicon regexes contain no free captures, so a marker can never be
 * arbitrary candidate text.
 * ------------------------------------------------------------------------- */

interface SignalProbe {
  strategy: InterviewStrategy;
  /** Becomes the decision reason, marker interpolated. */
  reason: (marker: string) => string;
}

/**
 * Priority order is the taxonomy table's order — ownership first, since
 * "what did *you* do" is the question the whole feature exists to ask.
 * One probe per turn: a barrage of "you said X, you said Y" in one steering
 * block reads as an accusation list, not an interview.
 */
const SIGNAL_PROBES: [BehavioralSignalType, SignalProbe][] = [
  [
    "OWNERSHIP_AMBIGUOUS",
    {
      strategy: "CHALLENGE_OWNERSHIP",
      reason: (m) =>
        `The candidate said "${m}" — quote their word back and ask what they specifically were responsible for.`,
    },
  ],
  [
    "DECISION_OWNER_UNCLEAR",
    {
      strategy: "CHALLENGE_OWNERSHIP",
      reason: (m) =>
        `The candidate said "${m}" without naming a decider — ask what their role in that decision was.`,
    },
  ],
  [
    "LEADERSHIP_CLAIM_UNVERIFIED",
    {
      strategy: "PROBE_ACTION",
      reason: (m) =>
        `The candidate claimed "${m}" — a claim to verify, not reward: ask what leading it involved and which decisions were theirs.`,
    },
  ],
  [
    "EXTERNAL_ATTRIBUTION",
    {
      strategy: "CHALLENGE_OWNERSHIP",
      reason: (m) =>
        `The candidate said "${m}" — ask what part of the situation was within their control.`,
    },
  ],
  [
    "IMPACT_UNQUANTIFIED",
    {
      strategy: "EXPLORE_RESULT",
      reason: (m) =>
        `The candidate claimed "${m}" with no number anywhere — ask how they measured it.`,
    },
  ],
  [
    "TECHNICAL_CLAIM_UNVERIFIED",
    {
      strategy: "DRILL_SPECIFICITY",
      reason: (m) =>
        `The candidate said "${m}" with no mechanism or measurement — ask what the bottleneck was and how they determined it.`,
    },
  ],
  [
    "LEARNING_UNVERIFIED",
    {
      strategy: "PROBE_ACTION",
      reason: (m) =>
        `The candidate said "${m}" — ask what concretely changed in how they work afterwards.`,
    },
  ],
];

/**
 * The probingDepth gate: how far down the priority list this persona probes.
 *
 * Depth 1 probes only the top tier; depth 10 probes all seven. Linear on
 * purpose — the dial must be sweepable by the eval, and a step function with
 * documented plateaus is the strictness mistake again.
 */
function probeTierLimit(probingDepth: number): number {
  return Math.max(
    1,
    Math.min(
      SIGNAL_PROBES.length,
      Math.ceil((probingDepth / 10) * SIGNAL_PROBES.length),
    ),
  );
}

/**
 * The one probe this turn earns, or null.
 *
 * The hard trigger — two or more diffuse-ownership phrases with no leadership
 * claim anywhere — bypasses the gate entirely: the professor's headline case
 * fires at any probing depth, because an answer that is all "helped with" and
 * "involved in" has left its central question unanswered no matter how gentle
 * the interviewer.
 */
function chooseEvidenceProbe(
  analysis: AnalysisResult,
  probingDepth: number,
): { strategy: InterviewStrategy; reason: string } | null {
  const signals = analysis.languageSignals?.signals ?? [];
  if (signals.length === 0) return null;

  const byType = new Map(signals.map((signal) => [signal.type, signal]));

  const diffuse = byType.get("OWNERSHIP_AMBIGUOUS");
  const hardTrigger =
    (diffuse?.markers.length ?? 0) >= 2 &&
    !byType.has("LEADERSHIP_CLAIM_UNVERIFIED");

  const limit = hardTrigger
    ? SIGNAL_PROBES.length
    : probeTierLimit(probingDepth);

  for (const [type, probe] of SIGNAL_PROBES.slice(0, limit)) {
    const signal = byType.get(type);
    const marker = signal?.markers[0];
    if (signal && marker) {
      return { strategy: probe.strategy, reason: probe.reason(marker) };
    }
  }
  return null;
}

/* ------------------------------------------------------------------------- *
 * Curveballs — pointer 2 of docs/INTERVIEWER.md.
 * ------------------------------------------------------------------------- */

/**
 * The only strategies a curveball may displace.
 *
 * The precedence rule, load-bearing: a weakness-driven move always wins. If
 * the answer was vague the candidate gets DRILL_SPECIFICITY, not a surprise —
 * which is also how real interviewers behave; they pivot when a thread is
 * done, not mid-weakness.
 */
const CURVEBALL_REPLACEABLE: ReadonlySet<InterviewStrategy> = new Set([
  "ACKNOWLEDGE_STRENGTH",
  "PROBE_ACTION",
]);

/**
 * Deterministic 32-bit hash (FNV-1a) of the seed inputs.
 *
 * Not `Math.random()`, deliberately: the engine is pure, the eval harness
 * replays it, and the route re-derives decisions after a late analysis on the
 * promise that identical input gives identical output. Unpredictable to the
 * candidate and reproducible to the harness are compatible requirements —
 * the candidate never sees the seed. Precedent: the coverage steer's rotation
 * offset in competencies.ts.
 */
function seededRoll(sessionId: string, turnIndex: number): number {
  let hash = 0x811c9dc5;
  const input = `${sessionId}:${turnIndex}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // Murmur3's finalizer on top: raw FNV-1a's low bits barely move between
  // sequential turn indices — turns 0-9 of one session all rolled 0.31-0.39,
  // so a whole stretch of an interview shared one curveball verdict. The
  // avalanche spreads a one-character seed change across every bit.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  // Two independent uses per turn: low bits decide *whether*, high bits *which*.
  return hash >>> 0;
}

/**
 * Style weights: given that a curveball fires, how strongly this archetype
 * leans toward the twist (vs. the pivot), and how its base rate scales.
 *
 * `rateFactor` multiplies the unpredictability-derived probability;
 * `twistBias` shifts the twist/pivot split. Values are small integers so the
 * arithmetic below stays legible in the eval's move-distribution sweep.
 */
const STYLE_CURVEBALL_WEIGHTS: Record<
  string,
  { rateFactor: number; twistBias: number }
> = {
  supportive: { rateFactor: 0.5, twistBias: -2 },
  socratic: { rateFactor: 1, twistBias: 2 },
  deep_dive: { rateFactor: 0.4, twistBias: 3 },
  bar_raiser: { rateFactor: 1.2, twistBias: 3 },
  conversational: { rateFactor: 1.2, twistBias: -2 },
  stress: { rateFactor: 1.5, twistBias: 4 },
};

/**
 * Replace an "answer is fine" strategy with a curveball, or return it as-is.
 *
 * Fires more readily when the ladder is repeating itself — a stuck strategy is
 * the natural moment a real interviewer changes tack — and never fires without
 * a seed, so callers that cannot supply one (old evals, tests that predate it)
 * keep classic ladder behaviour.
 */
export function maybeCurveball(
  base: InterviewStrategy,
  context: DecisionContext,
): InterviewStrategy {
  if (!CURVEBALL_REPLACEABLE.has(base)) return base;
  if (!context.seed) return base;

  const unpredictability = context.unpredictability ?? 5;
  if (unpredictability <= 1) return base;

  const style = context.questioningStyle ?? "conversational";
  const weights = STYLE_CURVEBALL_WEIGHTS[style] ?? {
    rateFactor: 1,
    twistBias: 0,
  };

  // Base rate: unpredictability 5 ≈ 30% of eligible turns before style
  // scaling; 10 ≈ 60%. Eligible turns are already the minority (only the two
  // replaceable strategies), so the felt rate is well below this.
  const repeated = context.previousStrategy === base;
  const chance = Math.min(
    0.9,
    (unpredictability / 10) * 0.6 * weights.rateFactor + (repeated ? 0.25 : 0),
  );

  const roll = seededRoll(context.seed.sessionId, context.seed.turnIndex);
  if ((roll & 0xffff) / 0x10000 >= chance) return base;

  // Which curveball. A pivot needs a destination — without an uncovered
  // competency to aim at, "change the subject" is the weaker move, so the
  // twist wins outright. With one, pushback and style tilt the choice:
  // skeptical, stress-y archetypes twist the scenario, conversational ones
  // change the subject. Ties break on the roll's untouched high bits.
  if (!context.uncoveredCompetency) return "HYPOTHETICAL_TWIST";
  const twistScore = (context.pushback ?? 5) - 5 + weights.twistBias;
  if (twistScore > 0) return "HYPOTHETICAL_TWIST";
  if (twistScore < 0) return "PIVOT_TOPIC";
  return ((roll >>> 16) & 1) === 0 ? "PIVOT_TOPIC" : "HYPOTHETICAL_TWIST";
}

export function decideInterviewAction(
  analysis: AnalysisResult,
  context: DecisionContext,
): DecisionOutcome {
  const base = chooseStrategy(analysis);

  /**
   * Fundamentals outrank probes: an answer that misread the question gets
   * clarified, not cross-examined about a hedge word inside its
   * misunderstanding. Everywhere else, the evidence probe replaces the
   * ladder's pick — the probe *is* the more specific version of what the
   * ladder wanted (its strategies are drawn from the same seven moves).
   */
  const probe =
    base === "CLARIFY_SITUATION"
      ? null
      : chooseEvidenceProbe(analysis, context.probingDepth ?? 5);
  /**
   * Order matters and encodes the precedence rule twice over: the evidence
   * probe wins over the curveball (an unowned claim is a weakness, and
   * weakness-driven moves always win), and the curveball only ever replaces
   * the two "answer is fine" outcomes.
   */
  const strategy = probe?.strategy ?? maybeCurveball(base, context);
  const vaguenessWeight = getVaguenessWeight(analysis);
  const previousStrategy = context.previousStrategy;

  const repeatedStrategy = previousStrategy === strategy;
  const strictness = context.strictness ?? 5;
  const warmth = context.warmth ?? 5;

  const confidence = Math.max(
    20,
    Math.min(
      95,
      // `?? 5` on the two judged inputs. A single `undefined` here made the
      // whole expression NaN, and `Math.max(20, Math.min(95, NaN))` is NaN —
      // which flowed into `appendTurn`'s `Math.round(NaN)` and was stored as
      // null. Confidence then read as "unknown" for the rest of the session
      // with nothing indicating why.
      Math.round(
        analysis.overallScore * 0.55 +
          (10 - (analysis.specificityMetrics?.vaguenessScore ?? 5)) * 3 +
          (analysis.confidenceIndicators?.assertivenessScore ?? 5) * 2 +
          strictness * 1.5 +
          (10 - warmth) * 0.5,
      ),
    ),
  );

  const shouldEscalate =
    analysis.overallScore < 45 || vaguenessWeight > 12 || repeatedStrategy;
  const shouldSlowDown =
    analysis.overallScore > 78 && warmth >= 7 && !repeatedStrategy;

  // A probe reason quotes the candidate's exact word, which is strictly more
  // useful to the interviewer than the generic strategy description.
  let reason =
    probe?.reason ??
    REASONS[usesTechnicalRubric(analysis) ? "technical" : "behavioral"][
      strategy
    ];

  // A pivot with a destination beats a pivot into the void: name the
  // competency the round has not covered yet, when coverage knows one.
  if (strategy === "PIVOT_TOPIC" && context.uncoveredCompetency) {
    reason += ` A good target: ${context.uncoveredCompetency}`;
  }

  if (repeatedStrategy) {
    reason +=
      " The previous strategy was repeated, so the next question should escalate slightly.";
  }

  return {
    strategy,
    reason,
    confidence,
    shouldEscalate,
    shouldSlowDown,
    nextFocus: analysis.followupTopics?.[0] ?? defaultFocus(analysis, strategy),
  };
}

/** Fallback when the analyzer suggested no follow-up topics. */
function defaultFocus(
  analysis: AnalysisResult,
  strategy: InterviewStrategy,
): string {
  if (strategy === "ACKNOWLEDGE_STRENGTH") return "deeper reasoning";
  return usesTechnicalRubric(analysis)
    ? "the concrete approach and its tradeoffs"
    : "specific examples";
}

export function estimateFollowupDifficulty(
  analysis: AnalysisResult,
  context: DecisionContext,
): number {
  const base = Math.max(
    1,
    Math.min(10, Math.round(analysis.overallScore / 10)),
  );
  const strictness = context.strictness ?? 5;
  const warmth = context.warmth ?? 5;
  // Boost only when we are about to repeat ourselves. The old test —
  // `context.previousStrategy ? 1 : 0` — fired on every turn after the first,
  // which is not what "repetition" means; it was masked because
  // `previousStrategy` was never actually supplied in production.
  const repetitionBoost =
    context.previousStrategy &&
    context.previousStrategy === chooseStrategy(analysis)
      ? 1
      : 0;

  return Math.max(
    1,
    Math.min(
      10,
      Math.round(base + repetitionBoost + (strictness - warmth) / 4),
    ),
  );
}
