import { PANEL_LABEL } from "@/components/dashboard/page-header";
import {
  LONG_PAUSE_SECONDS,
  type DeliveryMetrics,
  type FillerLabel,
  type PaceLabel,
} from "@/lib/speech-metrics";
import { cn } from "@/lib/utils";

type Tone = "good" | "warn";

/** The same marks as the live coaching rail: green is good, amber needs attention. */
const TONE_MARK: Record<Tone, string> = {
  good: "bg-success",
  warn: "bg-warning",
};

const TONE_TEXT: Record<Tone, string> = {
  good: "Good",
  warn: "Needs attention",
};

/** Bands from `paceFromWpm` in `speech-metrics.ts`. */
const PACE: Record<PaceLabel, { caption: string; tone: Tone }> = {
  slow: { caption: "Slower than conversation", tone: "warn" },
  measured: { caption: "Measured", tone: "good" },
  conversational: { caption: "Conversational", tone: "good" },
  fast: { caption: "Faster than conversation", tone: "warn" },
};

/** Bands from `fillerLabelFor`; "occasional" is neither good nor a problem. */
const FILLERS: Record<FillerLabel, { caption: string; tone: Tone | null }> = {
  clean: { caption: "Rare", tone: "good" },
  occasional: { caption: "Occasional", tone: null },
  frequent: { caption: "Frequent", tone: "warn" },
};

function formatSpan(seconds: number): string {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

type Measure = {
  label: string;
  value: string | number;
  unit?: string;
  caption: string;
  tone: Tone | null;
};

/**
 * How a spoken answer sounded: pace, filler words, long pauses and speaking
 * time, measured in the browser from the recognizer's own phrase timings.
 *
 * This was one line of text ("148 wpm (conversational) · 3 fillers") above the
 * coaching, which made the one feedback a typed answer cannot have look like a
 * footnote. It is now four measures in the hairline grid the live coaching rail
 * uses, each a large navy number with a caption. A mark appears only where the
 * number carries a judgement the code actually makes; pauses and speaking time
 * are facts, so they have none. See docs/DESIGN.md.
 */
export function DeliveryReadout({ metrics }: { metrics: DeliveryMetrics }) {
  const pace = metrics.paceLabel ? PACE[metrics.paceLabel] : null;
  const fillers = FILLERS[metrics.fillerLabel];
  const topFillers = metrics.fillerBreakdown
    .slice(0, 2)
    .map(({ word, count }) => `“${word}” ×${count}`)
    .join(", ");

  const measures: Measure[] = [
    {
      label: "Pace",
      value: metrics.wpm ?? "—",
      unit: metrics.wpm !== null ? "words/min" : undefined,
      caption: pace?.caption ?? "Too short to measure",
      tone: pace?.tone ?? null,
    },
    {
      label: "Filler words",
      value: metrics.fillerCount,
      caption:
        metrics.fillerCount === 0
          ? "None heard"
          : `${fillers.caption}: ${topFillers}`,
      tone: metrics.fillerCount === 0 ? "good" : fillers.tone,
    },
    {
      label: "Long pauses",
      value: metrics.longPauseCount,
      caption: `Gaps of ${LONG_PAUSE_SECONDS} s or more`,
      tone: null,
    },
    {
      label: "Speaking time",
      value:
        metrics.durationSeconds > 0 ? formatSpan(metrics.durationSeconds) : "—",
      caption: `${metrics.wordCount} word${metrics.wordCount === 1 ? "" : "s"}`,
      tone: null,
    },
  ];

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className={PANEL_LABEL}>Delivery</h3>
        <p className="text-xs text-slate-500">Measured from your recording</p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-100 lg:grid-cols-4">
        {measures.map((measure) => (
          <div key={measure.label} className="bg-white p-4">
            <dt className="text-xs text-slate-500">{measure.label}</dt>
            <dd className="mt-2 font-display text-2xl leading-none font-bold tracking-tight text-navy tabular-nums">
              {measure.value}
              {measure.unit && (
                <span className="ml-1 font-sans text-xs font-medium tracking-normal text-slate-500">
                  {measure.unit}
                </span>
              )}
            </dd>
            <dd className="mt-2 flex items-start gap-1.5 text-xs leading-snug text-slate-600">
              {measure.tone && (
                <>
                  <span
                    className={cn(
                      "mt-1 h-2 w-2 shrink-0 rounded-[2px]",
                      TONE_MARK[measure.tone],
                    )}
                    aria-hidden
                  />
                  <span className="sr-only">{TONE_TEXT[measure.tone]}: </span>
                </>
              )}
              <span>{measure.caption}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
