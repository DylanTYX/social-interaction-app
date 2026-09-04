"use client";

/**
 * The per-dimension radar for a round's scored answers.
 *
 * The score stays the headline — it drives the decision engine, the analytics
 * trend and the eval methodology — and this chart is presentation over the
 * rubric sub-scores the analyzer already produces on every turn. A single 62
 * hides which dimension cost the marks; the polygon shows the shape.
 *
 * Radar-specific honesty rules, since the form has known failure modes:
 *
 *   - **Fixed axis order.** The enclosed shape changes with axis order, so the
 *     order is declared once below, matches the rubric's own declaration
 *     order, and is never sorted by value.
 *   - **Every value is also text.** Each axis label carries its number, so the
 *     geometry is never the only encoding — that is this chart's table view.
 *   - **One polarity.** Outward always means better; vagueness is inverted
 *     into "Specificity" rather than plotted raw.
 *   - **Single series, no legend** — the card title names it. A future overlay
 *     (previous same-type session) would add the legend with it.
 */

import type { AnalysisResult } from "@/lib/response-analyzer";

export interface RadarAxis {
  label: string;
  /** 0–10, outward = better. */
  value: number;
}

type PartialAnalysis = Partial<AnalysisResult>;

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function collect(
  analyses: PartialAnalysis[],
  pick: (analysis: PartialAnalysis) => unknown,
): number | null {
  const values: number[] = [];
  for (const analysis of analyses) {
    const value = pick(analysis);
    if (typeof value === "number" && Number.isFinite(value)) {
      values.push(Math.max(0, Math.min(10, value)));
    }
  }
  return average(values);
}

/**
 * Axes for one round, averaged across its scored turns.
 *
 * Tolerant of anything: the analyses come back as stored jsonb whose shape is
 * whatever the analyzer wrote at the time, so every read is optional-chained
 * and a turn missing a block simply doesn't contribute. Returns null when no
 * axis got a single value — the caller renders nothing rather than an empty
 * spider web.
 *
 * Two families, matching the analyzer's two rubrics. `technical` covers
 * technical_swe, system_design and cs_fundamentals, whose seven sub-scores are
 * emitted regardless of which of the three is running; behavioural covers
 * behavioral, screening and hr on STAR plus specificity and clarity.
 */
export function buildRadarAxes(
  analyses: PartialAnalysis[],
  technical: boolean,
): RadarAxis[] | null {
  const axes: { label: string; value: number | null }[] = technical
    ? [
        {
          label: "Framing",
          value: collect(
            analyses,
            (a) =>
              (a.technicalScores as Record<string, unknown> | undefined)
                ?.problemFraming,
          ),
        },
        {
          label: "Approach",
          value: collect(
            analyses,
            (a) =>
              (a.technicalScores as Record<string, unknown> | undefined)
                ?.approach,
          ),
        },
        {
          label: "Correctness",
          value: collect(
            analyses,
            (a) =>
              (a.technicalScores as Record<string, unknown> | undefined)
                ?.correctness,
          ),
        },
        {
          label: "Complexity",
          value: collect(
            analyses,
            (a) =>
              (a.technicalScores as Record<string, unknown> | undefined)
                ?.complexity,
          ),
        },
        {
          label: "Communication",
          value: collect(
            analyses,
            (a) =>
              (a.technicalScores as Record<string, unknown> | undefined)
                ?.communication,
          ),
        },
        {
          label: "Edge cases",
          value: collect(
            analyses,
            (a) =>
              (a.technicalScores as Record<string, unknown> | undefined)
                ?.edgeCases,
          ),
        },
        {
          label: "Code quality",
          value: collect(
            analyses,
            (a) =>
              (a.technicalScores as Record<string, unknown> | undefined)
                ?.codeQuality,
          ),
        },
      ]
    : [
        {
          label: "Situation",
          value: collect(analyses, (a) => a.starAnalysis?.situation?.quality),
        },
        {
          label: "Task",
          value: collect(analyses, (a) => a.starAnalysis?.task?.quality),
        },
        {
          label: "Action",
          value: collect(analyses, (a) => a.starAnalysis?.action?.quality),
        },
        {
          label: "Result",
          value: collect(analyses, (a) => a.starAnalysis?.result?.quality),
        },
        {
          label: "Specificity",
          // Inverted so outward = better, like every other axis.
          value: (() => {
            const vagueness = collect(
              analyses,
              (a) => a.specificityMetrics?.vaguenessScore,
            );
            return vagueness === null ? null : 10 - vagueness;
          })(),
        },
        {
          label: "Clarity",
          value: collect(analyses, (a) => a.confidenceIndicators?.clarity),
        },
      ];

  if (axes.every((axis) => axis.value === null)) return null;
  // A missing axis plots at 0 only if we let it; plot the axes we have.
  return axes
    .filter((axis): axis is RadarAxis => axis.value !== null)
    .map((axis) => ({ label: axis.label, value: axis.value }));
}

const SIZE = 360;
const CENTER = SIZE / 2;
/** Leaves room for the labels outside the outer ring. */
const RADIUS = 108;
const RINGS = [2.5, 5, 7.5, 10];

function pointFor(
  index: number,
  total: number,
  value: number,
): [number, number] {
  // Start at 12 o'clock, clockwise — the fixed order made visible.
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const r = (value / 10) * RADIUS;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

function polygonPoints(
  total: number,
  valueAt: (index: number) => number,
): string {
  return Array.from({ length: total }, (_, index) =>
    pointFor(index, total, valueAt(index)).join(","),
  ).join(" ");
}

export function DimensionRadar({ axes }: { axes: RadarAxis[] }) {
  const total = axes.length;
  if (total < 3) return null;

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto h-auto w-full max-w-sm"
      role="img"
      aria-label={`Dimension profile: ${axes
        .map((axis) => `${axis.label} ${axis.value.toFixed(1)} out of 10`)
        .join(", ")}`}
    >
      {/* Recessive grid: rings and spokes stay quieter than the data. */}
      {RINGS.map((ring) => (
        <polygon
          key={ring}
          points={polygonPoints(total, () => ring)}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={1}
        />
      ))}
      {axes.map((axis, index) => {
        const [x, y] = pointFor(index, total, 10);
        return (
          <line
            key={axis.label}
            x1={CENTER}
            y1={CENTER}
            x2={x}
            y2={y}
            stroke="var(--color-border)"
            strokeWidth={1}
          />
        );
      })}

      {/* The data: 2px stroke, translucent fill, dots on the vertices. */}
      <polygon
        points={polygonPoints(total, (index) => axes[index].value)}
        fill="var(--color-primary)"
        fillOpacity={0.12}
        stroke="var(--color-primary)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {axes.map((axis, index) => {
        const [x, y] = pointFor(index, total, axis.value);
        return (
          <circle
            key={axis.label}
            cx={x}
            cy={y}
            r={3.5}
            fill="var(--color-primary)"
          >
            <title>{`${axis.label}: ${axis.value.toFixed(1)}/10`}</title>
          </circle>
        );
      })}

      {/* Labels wear ink, not the series color, and carry the value — the
          number is never geometry-only. Anchors follow the angle so text
          grows away from the plot. */}
      {axes.map((axis, index) => {
        const [x] = pointFor(index, total, 10);
        const dx = x - CENTER;
        const anchor = Math.abs(dx) < 12 ? "middle" : dx > 0 ? "start" : "end";
        const [lx, ly] = pointFor(index, total, 11.8);
        return (
          <text
            key={axis.label}
            x={lx}
            y={ly}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-slate-500"
            fontSize={11}
          >
            {axis.label}{" "}
            <tspan className="fill-slate-900" fontWeight={600}>
              {axis.value.toFixed(1)}
            </tspan>
          </text>
        );
      })}
    </svg>
  );
}
