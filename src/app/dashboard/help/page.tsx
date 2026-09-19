import Link from "next/link";
import { ArrowRight, Compass, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PANEL_LABEL,
  PageContainer,
  PageHeader,
} from "@/components/dashboard/page-header";
import { RoundGuides } from "@/components/help/round-guides";
import { TOUR_HREF } from "@/lib/onboarding";
import { MIN_POINTS_FOR_TREND } from "@/lib/progress-insights";
import { SIGNAL_READINGS } from "@/lib/report-insights";
import {
  FILLER_BANDS,
  FILLER_WORDS,
  LONG_PAUSE_SECONDS,
  PACE_BANDS,
} from "@/lib/speech-metrics";
import type { BehavioralSignalType } from "@/lib/text-metrics";

export const metadata = {
  title: "Tips & guides · ConvoTrainer",
};

/**
 * Tips & guides: how an answer is judged here, and how to use that.
 *
 * It was six cards of general interview advice in no particular order. The
 * advice was sound and could have come from any blog. What only this app can
 * tell you is how it marks you, so the page is now built from that:
 *
 *   1. How practice works: the answer, judge, adapt loop the project exists to
 *      build, in the order you meet it.
 *   2. What each round is scored on: the analyzer's criteria per round type,
 *      and what a strong answer looks like under that rubric.
 *   3. Back up every claim: the wording that makes the interviewer probe, with
 *      the report's own reading of each.
 *   4. Speaking out loud: the delivery measures and their thresholds.
 *   5. Getting better over time: the report, Sessions and Analytics.
 *
 * Every number and rule is read from the code that applies it: the criteria
 * from `round-types.ts`, the readings and advice from `report-insights.ts`, the
 * pace, filler and pause thresholds from `speech-metrics.ts`, and the trend
 * minimum from `progress-insights.ts`. The answer time limits are constants in
 * the two interview screens; change them there, then here.
 */

/** `RESPONSE_TIME_LIMIT_SECONDS` in `voice-session.tsx` and `chat/page.tsx`. */
const VOICE_ANSWER_MINUTES = 3;
const TEXT_ANSWER_MINUTES = 5;

const PRACTICE_STEPS: {
  title: string;
  body: string;
  link?: { label: string; href: string };
}[] = [
  {
    title: "Prepare with the real job",
    body: "Describe the role, then add the job description and your resume. The interviewer reads both, so the questions fit the job you want.",
    link: { label: "Job descriptions", href: "/dashboard/job-descriptions" },
  },
  {
    title: "Answer as you would in the room",
    body: "Speak your answers, or type them when you can't. Technical rounds add a code editor. An interview can run several rounds, like the real day.",
  },
  {
    title: "The interviewer adapts",
    body: "Each answer is scored before the next question is written. A vague answer gets a follow-up; a strong one gets a harder question. A later round knows what earlier ones asked.",
  },
  {
    title: "Review, then go again",
    body: "The report scores every answer and shows a stronger version. Analytics follows each round type over time and says what to practise next.",
    link: { label: "Analytics", href: "/dashboard/analytics" },
  },
];

/**
 * The wording `detectBehavioralSignals` listens for, with what to say instead.
 * The middle column is `SIGNAL_READINGS`, the words the report uses for the
 * same gap. A `Record`, so a new signal cannot ship without a row here.
 */
const EVIDENCE_ROWS: Record<
  BehavioralSignalType,
  { youSay: string; instead: string }
> = {
  OWNERSHIP_AMBIGUOUS: {
    youSay: "“I was involved in”, “I helped with”",
    instead: "What you owned: “I wrote the migration plan.”",
  },
  DECISION_OWNER_UNCLEAR: {
    youSay: "“We decided”, “the team chose”",
    instead: "Your part in it: “I proposed Redis, and the team agreed.”",
  },
  LEADERSHIP_CLAIM_UNVERIFIED: {
    youSay: "“I led”, “I was responsible for”",
    instead:
      "What leading meant: who you brought together and what you decided.",
  },
  EXTERNAL_ATTRIBUTION: {
    youSay: "“It wasn't my fault”, “they didn't deliver”",
    instead: "What you did about it, within your control.",
  },
  IMPACT_UNQUANTIFIED: {
    youSay: "“Significantly faster”, “much better”",
    instead: "The number: “from 900 ms to 200 ms”.",
  },
  TECHNICAL_CLAIM_UNVERIFIED: {
    youSay: "“I optimised the query”",
    instead: "The how: “by adding an index, then I measured it”.",
  },
  LEARNING_UNVERIFIED: {
    youSay: "“I learned”, “my main takeaway”",
    instead: "What you did differently the next time.",
  },
};

const EVIDENCE_GRID =
  "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)] md:gap-6";

const capitalise = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/** ["um", "uh", "i mean"] → "“um”, “uh” and “I mean”" */
function listWords(words: readonly string[]): string {
  const shown = words.map((word) => `“${word === "i mean" ? "I mean" : word}”`);
  if (shown.length <= 1) return shown.join("");
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

const ALWAYS_COUNTED = FILLER_WORDS.filter(
  (word) => !word.onlyBesideHesitation,
).map((word) => word.label);
const COUNTED_BESIDE_HESITATION = FILLER_WORDS.filter(
  (word) => word.onlyBesideHesitation,
).map((word) => word.label);

export default function HelpPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Tips & guides"
        description="How your answers are judged here, and how to use that to get better with every interview."
        actions={
          <Button asChild>
            <Link href="/simulate/setup">
              <Plus />
              New interview
            </Link>
          </Button>
        }
      />

      <GuideSection
        title="How practice works"
        description="Four steps. The third is the one a question bank or a chatbot cannot give you."
      >
        <Card className="gap-0 overflow-hidden py-0">
          {/* A hairline grid: the gaps show the card's slate ground. */}
          <ol className="grid grid-cols-1 gap-px bg-slate-100 md:grid-cols-2 xl:grid-cols-4">
            {PRACTICE_STEPS.map((step, index) => (
              <li key={step.title} className="flex flex-col bg-white px-5 py-5">
                <span className="font-display text-sm font-semibold text-primary tabular-nums">
                  {index + 1}
                </span>
                <h3 className="mt-1 font-display text-base font-semibold tracking-tight text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {step.body}
                </p>
                {step.link && (
                  <Link
                    href={step.link.href}
                    className="mt-3 inline-flex w-fit items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {step.link.label}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </Card>
      </GuideSection>

      <GuideSection
        title="What each round is scored on"
        description="Each round type has its own rubric, so a strong screening answer and a strong system design answer look nothing alike."
      >
        <RoundGuides />
      </GuideSection>

      <GuideSection
        title="Back up every claim"
        description="Some wording leaves your part unclear. The words alone don't lower your score: they prompt a follow-up, often quoting you, and the evidence you give then is what gets scored."
      >
        <Card className="gap-0 py-0">
          <div
            className={`hidden border-b border-slate-100 px-5 py-3 md:grid ${EVIDENCE_GRID}`}
            aria-hidden
          >
            <p className={PANEL_LABEL}>If you say</p>
            <p className={PANEL_LABEL}>The report reads</p>
            <p className={PANEL_LABEL}>Say instead</p>
          </div>
          <dl className="divide-y divide-slate-100">
            {(Object.keys(EVIDENCE_ROWS) as BehavioralSignalType[]).map(
              (signal) => (
                <div
                  key={signal}
                  className={`grid gap-1 px-5 py-3.5 text-sm ${EVIDENCE_GRID}`}
                >
                  <dt className="font-medium text-slate-900">
                    {EVIDENCE_ROWS[signal].youSay}
                  </dt>
                  <dd className="text-warning-emphasis">
                    <span className="sr-only">The report reads: </span>
                    {capitalise(SIGNAL_READINGS[signal])}
                  </dd>
                  <dd className="text-slate-600">
                    <span className="sr-only">Say instead: </span>
                    {EVIDENCE_ROWS[signal].instead}
                  </dd>
                </div>
              ),
            )}
          </dl>
        </Card>
      </GuideSection>

      <GuideSection
        title="Speaking out loud"
        description="A voice interview also measures how you sound. That is feedback only: your score comes from what you said."
      >
        <Card className="gap-0 py-0">
          <dl className="divide-y divide-slate-100">
            <GuideRow term="Pace">
              {PACE_BANDS.measured}–{PACE_BANDS.fastAbove} words a minute reads
              as measured or conversational. Slower or faster is flagged.
            </GuideRow>
            <GuideRow term="Filler words">
              {listWords(ALWAYS_COUNTED)} are counted, and{" "}
              {listWords(COUNTED_BESIDE_HESITATION)} only when next to a
              hesitation. Fewer than {FILLER_BANDS.cleanBelow} in every 100
              words is clean. A short pause beats a filler.
            </GuideRow>
            <GuideRow term="Pauses">
              A gap of {LONG_PAUSE_SECONDS} seconds or more in the middle of an
              answer is counted. Taking a moment before you start is not.
            </GuideRow>
            <GuideRow term="Time">
              Each answer gets {VOICE_ANSWER_MINUTES} minutes out loud, or{" "}
              {TEXT_ANSWER_MINUTES} typed. Aim to finish well inside it.
            </GuideRow>
            <GuideRow term="Cutting in">
              Tap the microphone while the interviewer is talking to answer
              straight away. Otherwise it opens by itself when they finish.
            </GuideRow>
          </dl>
        </Card>
      </GuideSection>

      <GuideSection
        title="Getting better over time"
        description="One interview is a data point. These are how a run of them becomes progress."
      >
        <Card className="gap-0 py-0">
          <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
            <div className="px-5 py-4">
              <p className={PANEL_LABEL}>On the report</p>
              <dl className="mt-1 divide-y divide-slate-100">
                <TipRow term="Predict your score">
                  The first time you open a report, guess your score before it
                  shows. The gap between how it felt and how it went is worth
                  knowing.
                </TipRow>
                <TipRow term="See a stronger answer">
                  Under any scored answer: yours rewritten, what to improve, and
                  an example answer.
                </TipRow>
                <TipRow term="Competency coverage">
                  What the interview explored, and what it never got to.
                </TipRow>
                <TipRow term="Your takeaways">
                  A private note at the end. Write what you will change while it
                  is fresh.
                </TipRow>
                <TipRow term="Practise again">
                  Opens setup with the same interview. Change one thing, such as
                  a harder interviewer, before you start.
                </TipRow>
              </dl>
            </div>
            <div className="px-5 py-4">
              <p className={PANEL_LABEL}>Across interviews</p>
              <dl className="mt-1 divide-y divide-slate-100">
                <TipRow
                  term="Follow each round type"
                  link={{ label: "Analytics", href: "/dashboard/analytics" }}
                >
                  Scores are compared only within a round type, because each has
                  its own rubric. A trend appears after {MIN_POINTS_FOR_TREND}{" "}
                  scored sessions of one type.
                </TipRow>
                <TipRow term="Compare like with like">
                  Stricter, less warm interviewers ask harder questions, so
                  compare scores from interviewers of similar difficulty.
                </TipRow>
                <TipRow
                  term="Compare two attempts"
                  link={{ label: "Sessions", href: "/dashboard/sessions" }}
                >
                  Tick two sessions and choose Compare to see what changed.
                </TipRow>
                <TipRow
                  term="Drill one weak spot"
                  link={{ label: "Quick drills", href: "/dashboard/drills" }}
                >
                  One Computer Science question, answered out loud or typed,
                  with feedback in a couple of minutes.
                </TipRow>
              </dl>
            </div>
          </div>
        </Card>
      </GuideSection>

      <GuideSection
        title="What an interview costs to run"
        description="Every question and every score is a call to a language model, and each one is counted."
      >
        <Card className="gap-0 py-0">
          <dl className="divide-y divide-slate-100">
            <GuideRow term="Tokens">
              The unit those calls are measured in. A token is roughly
              three-quarters of a word, counted on the way in and on the way
              out.
            </GuideRow>
            <GuideRow term="One answer, two calls">
              Scoring your answer and writing the next question are separate
              calls, by design: the score is what shapes the question, and the
              interviewer never sees the marking.
            </GuideRow>
            <GuideRow term="Short answers cost less">
              A brief answer is cheaper to score than a rambling one, and a
              one-word reply is not scored at all.
            </GuideRow>
            <GuideRow term="Repeated context is reused">
              The part of the interviewer&rsquo;s brief that does not change
              between turns is reused at a discount, so a long interview does
              not cost in proportion to its length.
            </GuideRow>
            <GuideRow term="See your own">
              Settings shows your tokens and an estimated cost for a period you
              choose, broken down by what they bought. Each report shows what
              that interview used.{" "}
              <Link
                href="/dashboard/settings?section=usage"
                className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
              >
                Your usage
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </GuideRow>
          </dl>
        </Card>
      </GuideSection>

      <Card className="gap-0 divide-y divide-slate-100 py-0">
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div>
            <h2 className="font-medium text-slate-900">Take the tour</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              A short walk around the dashboard: where to start, how to track
              your progress and where your documents live.
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="shrink-0 self-start sm:self-auto"
          >
            <Link href={TOUR_HREF}>
              <Compass />
              Take the tour
            </Link>
          </Button>
        </div>
        <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div>
            <h2 className="font-medium text-slate-900">Keyboard shortcut</h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Jump to any page or start an interview from anywhere.
            </p>
          </div>
          <p className="shrink-0 text-sm text-slate-500">
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-700">
              ⌘K
            </kbd>{" "}
            or{" "}
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium text-slate-700">
              Ctrl K
            </kbd>
          </p>
        </div>
      </Card>
    </PageContainer>
  );
}

/** A section heading outside its content, with one line under it. */
function GuideSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="mt-1 max-w-3xl text-sm text-pretty text-slate-500">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

function GuideRow({
  term,
  children,
}: {
  term: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 px-5 py-3.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6">
      <dt className="text-sm font-medium text-slate-900">{term}</dt>
      <dd className="text-sm leading-relaxed text-slate-600">{children}</dd>
    </div>
  );
}

function TipRow({
  term,
  link,
  children,
}: {
  term: string;
  link?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <div className="py-3">
      <dt className="text-sm font-medium text-slate-900">{term}</dt>
      <dd className="mt-0.5 text-sm leading-relaxed text-slate-600">
        {children}
        {link && (
          <>
            {" "}
            <Link
              href={link.href}
              className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
            >
              {link.label}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </>
        )}
      </dd>
    </div>
  );
}
