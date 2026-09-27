import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AnimatedDemo } from "@/components/marketing/animated-demo";
import {
  EXAMPLE_ANALYSES,
  EXAMPLE_NOTED_ANSWER,
  EXAMPLE_REPORT,
  FOLLOW_UP_EXAMPLE,
} from "@/components/marketing/landing-examples";
import {
  MarketingNav,
  type MarketingNavLink,
} from "@/components/marketing/marketing-nav";
import { Reveal } from "@/components/marketing/reveal";
import { RubricRadarExample } from "@/components/marketing/rubric-radar-example";
import { StatCounter } from "@/components/marketing/stat-counter";
import { TryQuestion } from "@/components/marketing/try-question";
import { COMPETENCIES } from "@/lib/competencies";
import { describeDifficulty } from "@/lib/interview-difficulty";
import { buildInterviewMetrics } from "@/lib/interview-metrics";
import { ROUND_TYPES, type InterviewRoundType } from "@/lib/interview-rounds";
import { createInterviewSessionState } from "@/lib/interview-session-state";
import { PRACTICE_MODES } from "@/lib/interview-setup";
import {
  communicationDetail,
  durationDetail,
  predictionDetail,
  starDetail,
} from "@/lib/report-insights";
import { ROUND_TYPE_SPECS } from "@/lib/round-types";
import { TILE_ACCENT, TILE_COLORS } from "@/lib/tile-colors";
import { cn } from "@/lib/utils";

/*
 * The landing page. Product-led: every section is one idea and one proof, and
 * the proof is a mock of the real interface with real content. Colour follows
 * the rules in docs/DESIGN.md — blue for actions, round colours only where a
 * round is named, green and amber only where a mark means something.
 */

const NAV_LINKS: MarketingNavLink[] = [
  { id: "how", label: "How it works" },
  { id: "different", label: "What makes it different" },
  { id: "rounds", label: "Rounds" },
  { id: "report", label: "Reports" },
  { id: "try", label: "Try it" },
];

/**
 * The order a real loop tends to run in, which is how the cards read best.
 * Every round type must appear here; `ROUND_TYPES` is the source of truth for
 * the count shown in the hero.
 */
const ROUND_ORDER: InterviewRoundType[] = [
  "screening",
  "behavioral",
  "technical_swe",
  "system_design",
  "cs_fundamentals",
  "hr",
];

const LOOP_EXAMPLE: InterviewRoundType[] = [
  "screening",
  "behavioral",
  "system_design",
];

const STEPS = [
  {
    title: "Set up the role",
    body: "Paste the job description, attach your resume if you like, then pick a single round or build a loop. Choose text or voice.",
  },
  {
    title: "Get interviewed",
    body: "Answer questions from an interviewer who follows up on what you actually said, and scores each answer as you go.",
  },
  {
    title: "Read the report",
    body: "Scored feedback with reasons, a suggested answer, a tightened rewrite of your own, and your trend across sessions.",
  },
] as const;

const WRAP = "mx-auto max-w-295 px-6";
const SECTION = "py-16 md:py-24 lg:py-28";
const EYEBROW = "text-[13.5px] font-semibold text-primary";
const H2 =
  "font-display text-[clamp(1.85rem,3.1vw,2.6rem)] font-bold leading-[1.1] tracking-tight text-balance text-slate-900";
const LEDE = "text-lg leading-relaxed text-pretty text-slate-600";
const MOCK = "rounded-[14px] border border-slate-200 bg-white p-5 shadow-soft-md";
const PANEL_LABEL = "text-xs font-semibold tracking-wide text-slate-500 uppercase";

/** A count in words, for a heading. Counts are derived, so the word is too. */
const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
function countWord(count: number): string {
  const word = NUMBER_WORDS[count] ?? String(count);
  return word.charAt(0).toUpperCase() + word.slice(1);
}

/*
 * The example report, computed the way the report computes it: the session
 * metrics from the answers' readings, then the report's own captions. See
 * `landing-examples.ts`.
 */
const EXAMPLE_METRICS = buildInterviewMetrics({
  analyses: EXAMPLE_ANALYSES,
  state: createInterviewSessionState("example", "Maya Kim"),
  restoredTurns: 0,
});
const EXAMPLE_SCORE = Math.round(EXAMPLE_METRICS.averageOverallScore);
const EXAMPLE_DIFFICULTY = describeDifficulty(
  EXAMPLE_REPORT.strictness,
  EXAMPLE_REPORT.warmth,
);
const EXAMPLE_NOTE = EXAMPLE_ANALYSES[EXAMPLE_NOTED_ANSWER];

/** A round's name in its own colour. The only place round colours appear as chips. */
function RoundTag({ type }: { type: InterviewRoundType }) {
  const spec = ROUND_TYPE_SPECS[type];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-md px-2 text-xs font-semibold",
        TILE_COLORS[spec.accent],
      )}
    >
      {spec.label}
    </span>
  );
}

function SectionHead({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede: string;
}) {
  return (
    <Reveal className="mx-auto mb-10 flex max-w-[60ch] flex-col items-center gap-3.5 text-center md:mb-14">
      <p className={EYEBROW}>{eyebrow}</p>
      <h2 className={H2}>{title}</h2>
      <p className={LEDE}>{lede}</p>
    </Reveal>
  );
}

function Story({
  eyebrow,
  title,
  body,
  flip = false,
  children,
}: {
  eyebrow: string;
  title: string;
  body: string;
  flip?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Reveal className="grid grid-cols-1 items-center gap-8 border-t border-slate-200 py-8 first:border-t-0 md:grid-cols-2 md:gap-16 md:py-12">
      <div
        className={cn(
          "flex max-w-[46ch] flex-col gap-3.5",
          flip && "md:order-2",
        )}
      >
        <p className={EYEBROW}>{eyebrow}</p>
        <h3 className="font-display text-[clamp(1.5rem,2.4vw,2rem)] font-semibold leading-tight tracking-[-0.02em] text-balance">
          {title}
        </h3>
        <p className="text-base leading-relaxed text-pretty text-slate-600">
          {body}
        </p>
      </div>
      <div className="min-w-0">{children}</div>
    </Reveal>
  );
}

function MockHead({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-3 text-[12.5px] text-slate-500">
      {children}
    </div>
  );
}

function ArrowRow({ label }: { label: string }) {
  return (
    <div className="my-3 flex items-center gap-2.5 text-[12.5px] font-semibold text-primary">
      <span>{label}</span>
      <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <MarketingNav links={NAV_LINKS} />

      <main id="top">
        {/* Hero: the claim, then the product as proof. */}
        <section className="pt-10 pb-12 md:pt-16 md:pb-20">
          <div className={WRAP}>
            <div className="mx-auto flex max-w-225 flex-col items-center gap-5 text-center">
              <p className={EYEBROW}>Mock interviews, text or voice</p>
              <h1 className="max-w-[22ch] font-display text-[clamp(2.3rem,4.6vw,3.8rem)] font-bold leading-[1.06] tracking-[-0.03em] text-balance text-slate-900">
                Practice with an interviewer who follows up.
              </h1>
              <p
                className={cn(
                  LEDE,
                  "max-w-[58ch] text-[clamp(1.05rem,1.3vw,1.2rem)]",
                )}
              >
                ConvoTrainer runs realistic mock interviews for the role
                you&apos;re going for. It listens to how you answer, scores each
                response as you go, and asks the follow-up a real interviewer
                would.
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                <Button
                  size="lg"
                  asChild
                  className="h-11 px-5 text-[15px] shadow-soft-md transition-all duration-200 hover:shadow-soft-lg"
                >
                  <Link href="/auth/register">
                    Start a mock interview
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="h-11 px-5 text-[15px]"
                >
                  <Link href="#try">Try one question first</Link>
                </Button>
              </div>
            </div>

            {/* The stage: a soft two-tone panel the interview window sits on. */}
            <div className="relative mx-auto mt-10 max-w-260 overflow-hidden rounded-[22px] bg-linear-to-br from-primary-subtle to-indigo-50 p-3.5 md:mt-13 md:p-7">
              <div
                className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(15,23,42,0.07)_1px,transparent_1px)] bg-size-[18px_18px]"
                aria-hidden="true"
              />
              <div className="relative">
                <AnimatedDemo />
              </div>
            </div>

            <div className="mt-8 flex items-center justify-center gap-5 sm:gap-12 md:mt-12">
              <StatCounter value={PRACTICE_MODES.length} label="Practice modes" />
              <div className="h-13 w-px bg-slate-200" aria-hidden="true" />
              {/* Derived, not typed: the count follows the product. */}
              <StatCounter
                value={ROUND_TYPES.length}
                label="Interview round types"
              />
              <div className="h-13 w-px bg-slate-200" aria-hidden="true" />
              <StatCounter
                value={COMPETENCIES.length}
                label="Competencies tracked"
              />
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className={cn(SECTION, "bg-slate-50")}>
          <div className={WRAP}>
            <SectionHead
              eyebrow="How it works"
              title="Set up the role. Answer questions. Read the report."
              lede="You describe the role. The interview runs like a real one. The report explains every score."
            />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <Reveal key={step.title} delay={index * 80}>
                  <article className="flex h-full flex-col gap-2.5 rounded-[14px] border border-slate-200 bg-white p-5.5 shadow-soft">
                    <span className="text-xs font-semibold tracking-wide text-primary uppercase">
                      Step {index + 1}
                    </span>
                    <h3 className="font-display text-lg font-semibold tracking-tight">
                      {step.title}
                    </h3>
                    <p className="text-[14.5px] leading-relaxed text-pretty text-slate-600">
                      {step.body}
                    </p>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* What makes it different */}
        <section id="different" className={SECTION}>
          <div className={WRAP}>
            <SectionHead
              eyebrow="What makes it different"
              title="Not a question bank."
              lede="A question bank can't hear what you left out, and it doesn't know the job. This does both."
            />

            <Story
              eyebrow="Adaptive follow-ups"
              title="It follows up on what you actually said."
              body="A vague answer gets drilled for specifics. A strong one gets pushed a level deeper. The next question is chosen from your last answer, not from a list."
            >
              {/* The phrase the detector flags in this answer, the report's
                  reading of it, and the follow-up the engine asks for. See
                  `landing-examples.ts`. */}
              <div className={MOCK}>
                <MockHead>
                  <span>Your answer</span>
                  <span className="inline-flex h-6 items-center rounded-md bg-warning-muted px-2 text-xs font-semibold text-warning-emphasis">
                    {FOLLOW_UP_EXAMPLE.reading.charAt(0).toUpperCase() +
                      FOLLOW_UP_EXAMPLE.reading.slice(1)}
                  </span>
                </MockHead>
                <p className="text-[15px] leading-relaxed text-slate-900">
                  &ldquo;{FOLLOW_UP_EXAMPLE.answerBefore}
                  <mark className="rounded-[2px] bg-warning-muted px-0.5 text-inherit shadow-[inset_0_-2px_0_var(--color-warning)]">
                    {FOLLOW_UP_EXAMPLE.marker}
                  </mark>
                  {FOLLOW_UP_EXAMPLE.answerAfter}&rdquo;
                </p>
                <ArrowRow label="Follow-up chosen" />
                <div className="rounded-[10px] bg-primary-subtle px-3.5 py-3 text-[14.5px] leading-relaxed text-blue-900">
                  {FOLLOW_UP_EXAMPLE.followUp}
                </div>
              </div>
            </Story>

            <Story
              flip
              eyebrow="Honest scoring"
              title="Scored against the real rubric for the round."
              body="Behavioral answers are judged on Situation, Task, Action and Result, and on how specific and clear you were. Technical ones on correctness, complexity and edge cases, among others. Each answer's score says what was missing, in plain words."
            >
              {/* The report's dimension profile and the note under one
                  answer, both drawn from the example round by the report's
                  own code. */}
              <div className={MOCK}>
                <MockHead>
                  <span>Dimension profile</span>
                  <RoundTag type="behavioral" />
                </MockHead>
                <p className="-mt-1.5 text-[13px] text-slate-500">
                  Averaged across this round&apos;s scored answers, on the STAR
                  rubric.
                </p>
                <div className="mt-2">
                  <RubricRadarExample />
                </div>
                <div className="mt-3 border-t border-slate-100 pt-3.5">
                  <p className={PANEL_LABEL}>
                    Under answer {EXAMPLE_NOTED_ANSWER + 1}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge
                      variant={
                        EXAMPLE_NOTE.overallScore >= 75 ? "success" : "warning"
                      }
                      className="font-semibold tabular-nums"
                    >
                      {EXAMPLE_NOTE.overallScore}%
                    </Badge>
                    <span className="text-xs text-slate-500">this answer</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs leading-relaxed">
                    {EXAMPLE_NOTE.gaps.map((gap) => (
                      <li
                        key={gap}
                        className="flex gap-1.5 text-warning-emphasis"
                      >
                        <CircleAlert
                          className="mt-0.5 size-3.5 shrink-0"
                          aria-hidden
                        />
                        <span>{gap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Story>

            <Story
              eyebrow="Tailored to the role"
              title="Built from the job description you paste in."
              body="Paste the posting and the questions come from what it actually asks for. Attach your resume and the interviewer reads it and asks about your real background."
            >
              <div className={MOCK}>
                <MockHead>
                  <span>From the job description you pasted</span>
                  <RoundTag type="system_design" />
                </MockHead>
                <p className="text-[13.5px] leading-relaxed text-slate-600">
                  Senior Backend Engineer, Payments. You will own the ledger
                  service that{" "}
                  <mark className="rounded-[2px] bg-primary-muted px-0.5 text-inherit shadow-[inset_0_-2px_0_var(--color-primary)]">
                    settles 40M transactions a day across three regions
                  </mark>{" "}
                  and work with product on reconciliation tooling.
                </p>
                <ArrowRow label="Asked because of this" />
                <div className="rounded-[10px] bg-primary-subtle px-3.5 py-3 text-[14.5px] leading-relaxed text-blue-900">
                  Walk me through how you&apos;d keep three regions consistent
                  when one of them goes dark mid-settlement.
                </div>
              </div>
            </Story>
          </div>
        </section>

        {/* Rounds: derived from the round specs, so nothing here can go stale. */}
        <section id="rounds" className={cn(SECTION, "bg-slate-50")}>
          <div className={WRAP}>
            <SectionHead
              eyebrow={`${countWord(ROUND_TYPES.length)} kinds of round`}
              title="Each round is scored the way that round is actually judged."
              lede="Run one on its own, or chain several into a full loop, and give each round its own interviewer if you like."
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ROUND_ORDER.map((type, index) => {
                const spec = ROUND_TYPE_SPECS[type];
                return (
                  <Reveal key={type} delay={(index % 3) * 80}>
                    <article className="relative flex h-full flex-col gap-2.5 overflow-hidden rounded-[14px] border border-slate-200 bg-white px-4.5 pt-4.5 pb-4 shadow-soft transition-[transform,box-shadow] duration-200 ease-soft hover:-translate-y-0.5 hover:shadow-soft-md motion-reduce:hover:translate-y-0">
                      <span
                        className={cn(
                          "absolute inset-y-0 left-0 w-1",
                          TILE_ACCENT[spec.accent],
                        )}
                        aria-hidden="true"
                      />
                      <div className="flex items-center justify-between gap-2.5">
                        <h3 className="font-display text-[1.1rem] font-semibold tracking-tight">
                          {spec.label}
                        </h3>
                        <span className="text-[12.5px] font-medium text-slate-500 tabular-nums">
                          {spec.defaults.durationMinutes} min
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-600">
                        {spec.rubric}
                        {spec.supports.codeEditor ? ", in a real editor." : "."}
                      </p>
                    </article>
                  </Reveal>
                );
              })}
            </div>
            <Reveal className="mt-8 flex flex-wrap items-center justify-center gap-x-3.5 gap-y-2.5 text-[15px] text-slate-600">
              <span>A full loop looks like</span>
              <span className="inline-flex items-center gap-1.5">
                {LOOP_EXAMPLE.map((type, index) => (
                  <Fragment key={type}>
                    {index > 0 && (
                      <span className="text-slate-400" aria-hidden="true">
                        →
                      </span>
                    )}
                    <RoundTag type={type} />
                  </Fragment>
                ))}
              </span>
              <span>and every interviewer gets a brief from the last.</span>
            </Reveal>
          </div>
        </section>

        {/* Reports */}
        <section id="report" className={SECTION}>
          <div
            className={cn(
              WRAP,
              "grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16",
            )}
          >
            <Reveal className="flex flex-col gap-4">
              <p className={EYEBROW}>Reports</p>
              <h2 className={H2}>Predict your score. Then see why.</h2>
              <p className={LEDE}>
                Before the number appears you guess it, so you learn how far
                your own read of an answer is from the interviewer&apos;s. Then
                the report breaks it down.
              </p>
              <ul className="mt-1.5 flex flex-col gap-3">
                {[
                  [
                    "A score for each rubric part",
                    ", with the weakest one named and what to do about it.",
                  ],
                  [
                    "A stronger answer",
                    " and your own answer tightened, for any answer you choose.",
                  ],
                  [
                    "Trends across sessions",
                    " in Analytics, so you can see where you're improving and what to work on next.",
                  ],
                  [
                    "Voice delivery",
                    ", when you speak your answers: pace, filler words and long pauses under each answer, and over time in Analytics.",
                  ],
                ].map(([lead, rest]) => (
                  <li
                    key={lead}
                    className="grid grid-cols-[8px_1fr] items-start gap-3 text-[15px] leading-relaxed text-slate-600"
                  >
                    <span
                      className="mt-1.75 h-2 w-2 rounded-[2px] bg-primary"
                      aria-hidden="true"
                    />
                    <span>
                      <b className="font-semibold text-slate-900">{lead}</b>
                      {rest}
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={80}>
              {/* The top of the report for the example round, computed by the
                  report's own functions: the score, what your guess and the
                  interviewer's difficulty say about it, the three tiles, and
                  one answer tightened. */}
              <div className="overflow-hidden rounded-[14px] border border-slate-200 bg-white shadow-soft-lg">
                <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-end sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm text-slate-500">Overall score</p>
                    <p className="font-display text-[56px] leading-none font-bold tracking-[-0.04em] text-navy tabular-nums">
                      {EXAMPLE_SCORE}%
                    </p>
                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-success-emphasis">
                      <TrendingUp className="h-3.5 w-3.5" aria-hidden />+
                      {EXAMPLE_SCORE - EXAMPLE_REPORT.previousScore} vs last
                      session
                    </span>
                  </div>
                  <div className="space-y-1.5 sm:max-w-xs sm:border-l sm:border-slate-200 sm:pl-5">
                    <p className="text-sm font-medium text-slate-700">
                      {predictionDetail(EXAMPLE_REPORT.predicted, EXAMPLE_SCORE)}
                    </p>
                    <p className="text-xs leading-relaxed text-slate-500">
                      <span className="font-medium text-slate-600">
                        {EXAMPLE_DIFFICULTY.label}.
                      </span>{" "}
                      {EXAMPLE_DIFFICULTY.note}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-3">
                  {[
                    [
                      "Communication",
                      `${Math.round(EXAMPLE_METRICS.averageConfidenceScore * 10)}%`,
                      communicationDetail(
                        EXAMPLE_METRICS.averageConfidenceScore,
                        EXAMPLE_ANALYSES,
                      ),
                    ],
                    [
                      "STAR average",
                      `${Math.round(EXAMPLE_METRICS.averageSTARScore * 10)}%`,
                      starDetail(EXAMPLE_ANALYSES),
                    ],
                    [
                      "Duration",
                      `${EXAMPLE_REPORT.durationMinutes} min`,
                      durationDetail(
                        EXAMPLE_REPORT.durationMinutes,
                        EXAMPLE_ANALYSES.length,
                      ),
                    ],
                  ].map(([label, value, caption]) => (
                    <div key={label} className="bg-white px-5 py-4">
                      <p className="text-[13px] text-slate-500">{label}</p>
                      <p className="mt-1.5 font-display text-2xl leading-none font-bold tracking-tight text-navy tabular-nums">
                        {value}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">
                        {caption}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                  <p className={PANEL_LABEL}>Your answer, tightened</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Your own facts, restructured. You could say this tomorrow.
                  </p>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-slate-700">
                    &ldquo;{EXAMPLE_REPORT.rewrite}&rdquo;
                  </p>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Try it */}
        <section id="try" className={cn(SECTION, "bg-slate-50")}>
          <div
            className={cn(
              WRAP,
              "grid items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16",
            )}
          >
            <Reveal className="flex flex-col gap-3.5">
              <p className={EYEBROW}>Try it, no account needed</p>
              <h2 className={H2}>Answer one question. See how it scores.</h2>
              <p className={LEDE}>
                Type how you&apos;d actually answer this and get a quick score,
                what worked, and what to fix. The full app goes deeper on every
                dimension.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <TryQuestion />
            </Reveal>
          </div>
        </section>

        {/* Closing: full-bleed navy, and it carries the footer. */}
        <section
          id="start"
          className="mt-4 bg-navy pt-14 pb-8 text-white md:mt-8 md:pt-22"
        >
          <div className={WRAP}>
            <Reveal className="flex flex-col items-center gap-3.5 text-center">
              <h2 className="font-display text-[clamp(1.85rem,3.1vw,2.6rem)] font-bold leading-[1.1] tracking-tight text-white">
                <span className="block">
                  Your next interview is a conversation.
                </span>
                <span className="block">Practice it like one.</span>
              </h2>
              <p className="max-w-[46ch] text-base leading-relaxed text-indigo-200">
                Describe the role, pick a round or build a loop, and start
                talking.
              </p>
              <Button
                size="lg"
                asChild
                className="mt-2.5 h-11 bg-white px-5 text-[15px] text-navy hover:bg-white/90"
              >
                <Link href="/auth/register">
                  Start a mock interview
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </Reveal>

            <footer className="mt-12 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-white/10 pt-6 text-sm text-slate-400 md:mt-18">
              <Link
                href="#top"
                className="font-display text-[19px] font-bold tracking-[-0.02em] text-white"
              >
                Convo<span className="text-blue-300">Trainer</span>
              </Link>
              <nav className="flex flex-wrap gap-5.5" aria-label="Footer">
                {NAV_LINKS.filter((link) => link.id !== "try").map((link) => (
                  <a
                    key={link.id}
                    href={`#${link.id}`}
                    className="transition-colors duration-150 hover:text-white"
                  >
                    {link.label}
                  </a>
                ))}
                <Link
                  href="/auth/login"
                  className="transition-colors duration-150 hover:text-white"
                >
                  Sign in
                </Link>
              </nav>
              <span>Built as a university research project</span>
            </footer>
          </div>
        </section>
      </main>
    </div>
  );
}
