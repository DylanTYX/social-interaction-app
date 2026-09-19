"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PANEL_LABEL } from "@/components/dashboard/page-header";
import type { InterviewRoundType } from "@/lib/interview-rounds";
import { STAR_ADVICE, STAR_KEYS, TECHNICAL_AREAS } from "@/lib/report-insights";
import {
  ROUND_TYPE_SPECS,
  roundTypeSpec,
  rubricCriteria,
} from "@/lib/round-types";
import { cn } from "@/lib/utils";

interface RoundGuide {
  /** The shape a strong answer of this type follows, in one sentence. */
  shape: string;
  good: string[];
  costly: string[];
}

/**
 * What a strong answer looks like, per round type, written to the candidate.
 *
 * Paraphrased from `COACH_RUBRICS` in `lib/coach-rubric.ts`, which is what the
 * coach is told good looks like. That file is written to a model, in the third
 * person, so it is not shown verbatim; if its signals or failure modes change,
 * change these. The list of what is scored is not copied at all: it comes from
 * `rubricCriteria`, the same list the analyzer marks against.
 *
 * A `Record` over the round types, so a new type cannot ship without a guide.
 */
const ROUND_GUIDES: Record<InterviewRoundType, RoundGuide> = {
  screening: {
    shape:
      "Two beats: where you are now, then why this role is your next step.",
    good: [
      "Name something specific about this company or role, not a compliment that fits any employer.",
      "Link one strand of your experience to what the role needs, instead of walking through your whole resume.",
      "Keep it to about ninety seconds.",
      "Finish deliberately, ideally on a question of your own.",
    ],
    costly: [
      "An answer that would work word for word at another company.",
      "Your resume read out in order, oldest job first.",
      "Enthusiasm in place of a reason: “I'm really passionate about this space.”",
      "Trailing off instead of finishing.",
    ],
  },
  behavioral: {
    shape:
      "One real incident, told in the first person: Situation, Task, Action, Result.",
    good: [
      "Pick a situation with a time and a place, not a kind of situation.",
      "Say “I” for the actions that mattered, so it is clear what you did.",
      "Attach a number, a date or a decision to the result.",
      "Say what it cost, or what you would do differently.",
    ],
    costly: [
      "“We” throughout, so nobody can tell what you did.",
      "Your general view on teamwork instead of one story.",
      "Stopping at the action without saying how it ended.",
      "A result with no measure: “it went really well”.",
    ],
  },
  hr: {
    shape:
      "What you want, in order; logistics answered plainly; then a question only this company could answer.",
    good: [
      "Rank what you want, so the trade-offs are clear.",
      "Give a real salary range and a real notice period.",
      "Show a value through something you did, not an adjective.",
      "Close with a question about this company in particular.",
    ],
    costly: [
      "“I'm flexible” as the answer to a logistics question.",
      "Values as adjectives, like “collaborative”, with nothing behind them.",
      "“No questions from me.”",
      "Saying what you want without saying what you would give up.",
    ],
  },
  technical_swe: {
    shape:
      "Restate the problem and its limits, explain your approach and why, write the code, then give its complexity and edge cases.",
    good: [
      "Think out loud, so your reasoning arrives before the code.",
      "Say why your data structure beats the alternative.",
      "State both time and space complexity, and check them.",
      "Handle the edge cases the problem implies: empty input, duplicates, overflow, the boundaries.",
    ],
    costly: [
      "Coding in silence, so your reasoning is invisible.",
      "A brute-force solution offered without saying that it is one.",
      "A complexity claim that does not survive checking.",
      "No edge cases at all.",
    ],
  },
  system_design: {
    shape:
      "Requirements and scale first, then the architecture, then the trade-off you are making and what it costs.",
    good: [
      "Put numbers on the requirements before naming a component: reads, writes, latency, growth.",
      "Make an estimate, then use it to justify a later choice.",
      "Justify each component against the one it replaced.",
      "Say what your design gives up, and when it breaks.",
    ],
    costly: [
      "Components named without the problem each one solves.",
      "“Scalable and highly available” stated rather than shown.",
      "No numbers anywhere, so no choice can be checked.",
      "No trade-off, which means no decision was made.",
    ],
  },
  cs_fundamentals: {
    shape:
      "Define it precisely, contrast it with what it is confused with, then give a case where the difference mattered.",
    good: [
      "Explain the mechanism, not just the name.",
      "Name the alternative, and when that one is the better choice.",
      "Ground it in something you built, debugged or measured.",
      "State the cost as well as the benefit.",
    ],
    costly: [
      "A textbook definition with no example.",
      "Being confidently wrong, which costs more here than hedging.",
      "“Faster” or “more scalable” with no mechanism behind it.",
      "Not knowing when the alternative would win.",
    ],
  },
};

const ROUND_TYPES = Object.keys(ROUND_TYPE_SPECS) as InterviewRoundType[];

const capitalise = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/**
 * The breakdown the report gives for this round type, line for line: the same
 * advice strings the report prints beside its weakest part.
 */
function reportBreakdown(
  type: InterviewRoundType,
): { title: string; rows: [string, string][] } | null {
  if (type === "behavioral") {
    return {
      title: "Each STAR part is scored",
      rows: STAR_KEYS.map(([part]) => [part, capitalise(STAR_ADVICE[part])]),
    };
  }
  if (type === "technical_swe") {
    return {
      title: "Each area is scored",
      rows: TECHNICAL_AREAS.map(([, label, advice]) => [
        label,
        capitalise(advice),
      ]),
    };
  }
  return null;
}

/**
 * Six round types, one at a time, under the same underline tabs Analytics
 * uses for them. Each has its own rubric, so each has its own guide.
 */
export function RoundGuides() {
  const [active, setActive] = useState<InterviewRoundType>("behavioral");
  const spec = roundTypeSpec(active);
  const guide = ROUND_GUIDES[active];
  const breakdown = reportBreakdown(active);

  return (
    <div className="space-y-4">
      <div
        // One row that scrolls on a phone, bleeding to the screen edge so the
        // cut-off tab is the hint that there are more. Six tabs wrapped into
        // three rows and read as a list, not a tab strip. From `sm` it wraps
        // as before.
        className="-mx-6 flex items-center gap-x-6 overflow-x-auto border-b border-slate-200 px-6 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:gap-y-2 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
        role="group"
        aria-label="Round type"
      >
        {ROUND_TYPES.map((type) => {
          const current = type === active;
          return (
            <button
              key={type}
              type="button"
              aria-pressed={current}
              onClick={(event) => {
                setActive(type);
                // Bring a tab chosen at the edge of the strip fully into view.
                event.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest" });
              }}
              className={cn(
                "-mb-px shrink-0 border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors duration-150",
                "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-muted",
                current
                  ? "border-primary text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-900",
              )}
            >
              {roundTypeSpec(type).label}
            </button>
          );
        })}
      </div>

      <Card className="gap-0 py-0">
        <div className="border-b border-slate-100 px-5 py-4">
          <p className={PANEL_LABEL}>Scored on</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {rubricCriteria(active).map((criterion) => (
              <Badge
                key={criterion}
                variant="secondary"
                className="h-6 font-normal"
              >
                {capitalise(criterion)}
              </Badge>
            ))}
          </div>
          <p className="mt-4 font-display text-lg font-semibold tracking-tight text-balance text-slate-900">
            {guide.shape}
          </p>
          {spec.supports.codeEditor && (
            <p className="mt-1 text-sm text-slate-500">
              This round has a code editor. The interviewer reads your code; it
              is never run.
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
          <GuideList title="What scores well" items={guide.good} tone="good" />
          <GuideList
            title="What costs marks"
            items={guide.costly}
            tone="costly"
          />
        </div>

        {breakdown && (
          <div className="border-t border-slate-100 px-5 py-4">
            <p className={PANEL_LABEL}>{breakdown.title}</p>
            <p className="mt-1 text-sm text-slate-500">
              Your report names the weakest one and prints the line beside it.
            </p>
            <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
              {breakdown.rows.map(([label, advice]) => (
                <div key={label} className="flex gap-3 text-sm">
                  <dt className="w-24 shrink-0 font-medium text-slate-900">
                    {label}
                  </dt>
                  <dd className="text-slate-600">{advice}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </Card>
    </div>
  );
}

function GuideList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "good" | "costly";
}) {
  const Icon = tone === "good" ? Check : X;
  return (
    <div className="px-5 py-4">
      <p className={PANEL_LABEL}>{title}</p>
      <ul className="mt-3 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-relaxed">
            <Icon
              className={cn(
                "mt-1 h-3.5 w-3.5 shrink-0",
                tone === "good" ? "text-success" : "text-slate-400",
              )}
              aria-hidden
            />
            <span className="text-slate-700">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
