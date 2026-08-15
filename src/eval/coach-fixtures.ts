import type { InterviewRoundType } from "@/lib/interview-rounds";
import type { QualityBand } from "@/eval/fixtures";

/**
 * Supplementary fixtures for the coaching harness.
 *
 * The main golden set in `fixtures.ts` is the primary corpus and stays that
 * way: uplift needs the original answer's quality to be *known*, the bands
 * supply the headroom prediction that makes the metric falsifiable (weak
 * fixtures should gain more than strong ones, because strong ones start in the
 * eighties), and the analyzer's behaviour on that exact text has already been
 * measured. A second full corpus would double the labelling burden and double
 * the "everything came from one author" criticism `docs/EVALUATION.md` already
 * concedes twice.
 *
 * These four exist for the one property that set is structurally unable to
 * measure. Several of its weak fixtures — `beh-weak-conflict`, `screen-weak`,
 * `case-weak` — contain **no numerals at all**, so fact retention is 0 of 0 and
 * undefined, and a coach that invents quantities is indistinguishable from one
 * that does not. The no-fabrication clause is the coach's strictest contract
 * and the main corpus cannot put it under load.
 *
 * `weak-dense` is the fixture that matters most. It is a bad answer that
 * happens to be full of real numbers — a candidate who has the evidence and
 * buries it. A good coach surfaces the candidate's own figures; a fabricating
 * one adds figures that were never there. Every other fixture here can be
 * passed by a coach that simply copies numbers across.
 */

export interface CoachFixture {
  id: string;
  roundType: InterviewRoundType;
  band: QualityBand;
  question: string;
  answer: string;
  /** Why this answer sits in this band. */
  rationale: string;
  /**
   * The quantities a faithful rewrite must preserve, hand-listed.
   *
   * Ground truth for the retention metric. Without it the harness is only ever
   * checking a regex against itself: the numeral extractor decides both what
   * counts as a fact and whether the fact survived, so a bug in the extractor
   * reads as a perfect score.
   */
  checkableFacts: string[];
}

export const COACH_FIXTURES: CoachFixture[] = [
  {
    id: "weak-dense",
    roundType: "behavioral",
    band: "weak",
    question:
      "Tell me about a time you improved something about how your team worked.",
    answer:
      "So we had a lot of problems with our release process, it was taking like 3 hours every time and we did it twice a week. I looked at it and there was a lot of manual steps, I think 14 of them. Anyway I ended up automating some of it over about 2 months and afterwards it was down to about 25 minutes. The team was happier. I think in the end we were doing maybe 8 releases a week instead of 2. That's basically it, it was mostly just scripting really, nothing that clever.",
    rationale:
      "Every number a strong answer needs is present — 3 hours, twice a week, 14 steps, 2 months, 25 minutes, 2 to 8 releases — but there is no structure, no stated task, the actions are vague ('automating some of it'), and the candidate actively undercuts their own result. Weak on delivery, dense in facts. The one fixture where surfacing versus inventing can actually be told apart.",
    checkableFacts: ["3 hours", "twice a week", "14", "2 months", "25 minutes", "8"],
  },
  {
    id: "dense-screening",
    roundType: "screening",
    band: "mediocre",
    question: "Walk me through your background and why this role.",
    answer:
      "I've been a backend engineer for 6 years, the last 3 at a fintech called Aperture Payments where I owned the ledger service. It handles about 40,000 transactions a day and I took its p99 from 800ms to 210ms last year. Before that I was at a smaller startup for 3 years doing mostly Django. I'm looking at this role because I want to work on something at a larger scale.",
    rationale:
      "Specific and quantified, but the 'why this role' half is one generic sentence that would fit any employer — the exact screening failure mode. Mediocre rather than weak because the background half is genuinely strong, which gives the coach something to preserve while it fixes the other half.",
    checkableFacts: ["6 years", "3", "40,000", "800ms", "210ms", "3 years"],
  },
  {
    id: "dense-design",
    roundType: "system_design",
    band: "mediocre",
    question: "Design a URL shortener.",
    answer:
      "I'd use a hash of the URL, base62 encoded, 7 characters gives you about 3.5 trillion combinations. Store it in Postgres with an index on the short code. Put Redis in front for reads since it'll be read-heavy, maybe 100:1 reads to writes. Add a CDN. For scale I'd shard by the short code prefix once we're past a few hundred million rows. Should handle it fine.",
    rationale:
      "Real numbers and a defensible architecture, but the requirements were never established — no traffic estimate, no latency target, no retention policy — so every choice is asserted rather than derived, and no tradeoff is named. Mediocre: the components are right, the reasoning that would justify them is missing.",
    checkableFacts: ["7", "3.5 trillion", "100:1", "hundred million"],
  },
  {
    id: "dense-hr",
    roundType: "hr",
    band: "weak",
    question:
      "What are you looking for in your next role, and what does your notice period look like?",
    answer:
      "I'm pretty flexible on most things really. I'd like to keep growing and work somewhere collaborative with good people. Compensation-wise I'm open, whatever's fair for the market. My notice is 3 months but I could probably be flexible on that too. I don't really have any questions, you've covered everything.",
    rationale:
      "The HR failure mode in full: 'flexible' as the answer to a logistics question, values as bare adjectives, no ranking of priorities, and 'no questions from me' at the end. Contains exactly one checkable fact, which is the point — a coach that invents a salary range here has broken the contract in the most visible possible way.",
    checkableFacts: ["3 months"],
  },
];

/**
 * One answer, coached six times, once per round type.
 *
 * Held constant so that nothing except the rubric can explain a difference in
 * the coaching — the same construction `run-persona-eval.ts` uses for its two
 * personas, and for the same reason.
 *
 * Deliberately middling and deliberately round-type-neutral. It describes a
 * technical change with a business outcome and no code, so it is plausible as
 * an answer under all six rubrics: a behavioural round would want the STAR
 * frame, system design would want the capacity numbers, HR would want the
 * motivation behind it. A strong answer would leave the coach nothing to say;
 * a nonsense one would collapse every rubric into "start over".
 */
export const HELD_CONSTANT_QUESTION =
  "Tell me about a technical decision you made and how it turned out.";

export const HELD_CONSTANT_ANSWER =
  "We were having issues with our deployment process so I moved us to a different approach. It took a while to get everyone on board and there was some pushback from the team at first. I looked at what other companies were doing and picked something that seemed reasonable for our size. After we switched things were noticeably better and we had fewer problems in production. Overall I'd say it was the right call, though there were some things I'd do differently if I did it again.";
