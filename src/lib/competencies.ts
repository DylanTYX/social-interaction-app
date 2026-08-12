/**
 * Competency taxonomy for coverage tracking.
 *
 * Interview questions are improvised by the model turn to turn, with nothing
 * checking that the session actually explored a spread of competencies. A
 * candidate could finish twelve turns having been asked four variations of
 * "tell me about a project" and never once about conflict, failure, or
 * ambiguity — and the report would say nothing about the gap.
 *
 * Each competency carries a `probe` description that is embedded once and
 * compared against each question the interviewer asks. That reuses the
 * embedding infrastructure already built for job-description retrieval, and
 * gives the steering block a concrete instruction: here is what has not been
 * covered yet.
 *
 * The descriptions are written as the kind of sentence a *question* about that
 * competency would resemble, not as a definition — cosine similarity compares
 * the question text to these, so phrasing them like questions matters.
 */

export interface Competency {
  id: string;
  label: string;
  /** Short explanation shown in the report's coverage view. */
  summary: string;
  /** Embedded and matched against interviewer questions. */
  probe: string;
}

export const COMPETENCIES: readonly Competency[] = [
  {
    id: "conflict",
    label: "Conflict & disagreement",
    summary: "Handling disagreement with colleagues, managers or stakeholders.",
    probe:
      "Tell me about a time you disagreed with a teammate or your manager. How did you handle the conflict and what was the outcome?",
  },
  {
    id: "failure",
    label: "Failure & resilience",
    summary: "Owning a mistake or missed goal and what changed afterwards.",
    probe:
      "Describe a project that failed or a goal you missed. What went wrong, what was your part in it, and what did you change afterwards?",
  },
  {
    id: "ambiguity",
    label: "Ambiguity",
    summary: "Making progress without clear requirements or direction.",
    probe:
      "Tell me about a time you had to make progress with unclear requirements, incomplete information, or no obvious direction.",
  },
  {
    id: "leadership",
    label: "Leadership & influence",
    summary: "Leading or persuading without formal authority.",
    probe:
      "Describe a time you led a project or persuaded others to adopt your approach when you had no authority over them.",
  },
  {
    id: "prioritisation",
    label: "Prioritisation",
    summary: "Choosing between competing demands under constraint.",
    probe:
      "Tell me about a time you had too much to do and had to decide what to drop. How did you prioritise and what did you say no to?",
  },
  {
    id: "data_decisions",
    label: "Data-driven decisions",
    summary: "Using evidence and metrics rather than intuition.",
    probe:
      "Walk me through a decision you made using data. What did you measure, what did the numbers say, and how did it change what you did?",
  },
  {
    id: "ownership",
    label: "Ownership & initiative",
    summary: "Going beyond the assigned scope without being asked.",
    probe:
      "Tell me about something you took on that nobody asked you to do. Why did you do it and what happened?",
  },
  {
    id: "collaboration",
    label: "Collaboration",
    summary: "Working across teams and functions.",
    probe:
      "Describe a time you worked with another team or function. How did you coordinate and where did it get difficult?",
  },
  {
    id: "communication",
    label: "Communicating complexity",
    summary: "Explaining technical or complex work to a non-expert audience.",
    probe:
      "Tell me about a time you explained something technical or complicated to someone without that background. How did you approach it?",
  },
  {
    id: "feedback",
    label: "Feedback & growth",
    summary: "Receiving criticism and acting on it.",
    probe:
      "Describe a time you received difficult feedback. How did you react and what did you do differently afterwards?",
  },
  {
    id: "scale_tradeoffs",
    label: "Technical tradeoffs",
    summary: "Weighing cost, scale, and maintainability against each other.",
    probe:
      "Talk me through a technical tradeoff you made. What were the alternatives, what did you optimise for, and what did it cost you?",
  },
  {
    id: "customer_focus",
    label: "Customer focus",
    summary: "Grounding decisions in real user or customer need.",
    probe:
      "Tell me about a time you changed direction because of what a user or customer told you. How did you find out and what did you do?",
  },
] as const;

function getCompetency(id: string): Competency | undefined {
  return COMPETENCIES.find((c) => c.id === id);
}

/**
 * Cosine similarity above which a question counts as probing a competency.
 *
 * Tuned deliberately loose. A false negative — failing to mark something
 * covered — costs a redundant question later, which is mildly annoying. A
 * false positive marks a competency explored when it was not, which silently
 * defeats the whole point. When unsure, prefer not to mark.
 */
export const COVERAGE_THRESHOLD = 0.42;

export interface CompetencyCoverage {
  /** Competency id -> best similarity seen so far, for covered ones only. */
  covered: Record<string, number>;
}

export function emptyCoverage(): CompetencyCoverage {
  return { covered: {} };
}

/** Tolerant of anything previously stored, including nothing. */
export function parseCoverage(value: unknown): CompetencyCoverage {
  if (!value || typeof value !== "object") return emptyCoverage();
  const covered = (value as CompetencyCoverage).covered;
  if (!covered || typeof covered !== "object") return emptyCoverage();

  const cleaned: Record<string, number> = {};
  for (const [id, score] of Object.entries(covered)) {
    if (
      typeof score === "number" &&
      Number.isFinite(score) &&
      getCompetency(id)
    ) {
      cleaned[id] = score;
    }
  }
  return { covered: cleaned };
}

export function uncoveredCompetencies(
  coverage: CompetencyCoverage,
): Competency[] {
  return COMPETENCIES.filter((c) => !(c.id in coverage.covered));
}

export function coveragePercent(coverage: CompetencyCoverage): number {
  return Math.round(
    (Object.keys(coverage.covered).length / COMPETENCIES.length) * 100,
  );
}

export interface CompetencyHistory {
  competency: Competency;
  /** Sessions in which a question touched this competency. */
  sessions: number;
}

/**
 * How often each competency has come up, across every session.
 *
 * Coverage has always been recorded per session and shown on that session's
 * report — which answers "did this interview touch delegation?" but not the
 * question a candidate preparing for a real interview actually has: "what have
 * I still never been asked about?"
 *
 * Nothing new is stored for this. `competency_coverage` is already a column on
 * every session and already travels in the list the analytics page fetches; it
 * was simply never looked at more than one session at a time.
 *
 * Returned sorted rarest-first, because the useful end of this list is the
 * bottom of it.
 */
export function aggregateCoverage(
  coverages: readonly unknown[],
): CompetencyHistory[] {
  const counts = new Map<string, number>();

  for (const raw of coverages) {
    const { covered } = parseCoverage(raw);
    for (const id of Object.keys(covered)) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }

  return COMPETENCIES.map((competency) => ({
    competency,
    sessions: counts.get(competency.id) ?? 0,
  })).sort(
    (a, b) =>
      a.sessions - b.sessions ||
      a.competency.label.localeCompare(b.competency.label),
  );
}

/** Cosine similarity of two equal-length vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Fold one question's similarity scores into the running coverage, keeping the
 * best score seen per competency.
 */
export function applyCoverage(
  coverage: CompetencyCoverage,
  similarities: Array<{ id: string; similarity: number }>,
  threshold = COVERAGE_THRESHOLD,
): CompetencyCoverage {
  const covered = { ...coverage.covered };

  for (const { id, similarity } of similarities) {
    if (similarity < threshold || !getCompetency(id)) continue;
    covered[id] = Math.max(covered[id] ?? 0, similarity);
  }

  return { covered };
}

/**
 * The instruction handed to the interviewer. Naming two specific competencies
 * works better than "cover more ground": it gives the model something concrete
 * to convert into a question.
 */
export function formatCoverageSteer(
  coverage: CompetencyCoverage,
  max = 2,
): string | null {
  const remaining = uncoveredCompetencies(coverage);
  if (remaining.length === 0 || remaining.length === COMPETENCIES.length) {
    // Nothing left, or nothing asked yet — no useful steer either way.
    return null;
  }

  // Rotate the starting point by how many competencies are already covered.
  // Always taking the first two in declaration order made every session steer
  // toward conflict then failure, so an "improvised" interview came out
  // identical for every user.
  const offset = Object.keys(coverage.covered).length % remaining.length;
  const picks = Array.from(
    { length: Math.min(max, remaining.length) },
    (_, i) => remaining[(offset + i) % remaining.length],
  );
  return [
    `- Competencies not yet explored in this interview: ${picks
      .map((c) => c.label.toLowerCase())
      .join(", ")}.`,
    "- Prefer a question that opens one of them, unless the coaching signal above points somewhere more urgent.",
  ].join("\n");
}
