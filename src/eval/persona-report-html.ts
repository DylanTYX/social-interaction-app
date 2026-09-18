/**
 * The persona evaluation as a page you can read at a glance.
 *
 * The text artifact is the record; this is the same numbers arranged so a
 * reader can see them. `95% CI [0.3, 1.3]` in a monospace column is precise and
 * almost unreadable — an error bar that does or does not cross zero is the same
 * fact, understood in a second.
 *
 * **Generated, never hand-written.** It renders from the identical object the
 * JSON artifact is serialised from, in the same run, so the page cannot drift
 * from the data the way a hand-drawn chart does the moment a threshold moves.
 * Self-contained: no scripts, no fonts, no network, so it opens from a file://
 * URL years from now and still draws.
 */

import type { DialSweep, StrategyCoverage } from "./persona-sweeps";
import type { DialResult, JudgeAxis } from "./persona-experiment";

interface Deterministic {
  dials: DialSweep[];
  coverage: StrategyCoverage;
  probeBaseline: string;
}

interface Empirical {
  runs: number;
  model: string;
  judgeModel: string;
  dials: DialResult[];
  costUsd: number;
}

const escape = (value: string) =>
  value.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );

/** Colour a dial's ten steps, so a plateau is visible rather than counted. */
function resolutionStrip(sweep: DialSweep): string {
  const felt = sweep.consumers
    .filter((c) => c.kind === "questioning" || c.kind === "delivery")
    .map((c) => c.name);

  const key = (index: number) =>
    JSON.stringify(felt.map((name) => sweep.points[index].readings[name]));

  // One hue per distinct behaviour, so identical steps are identical blocks.
  const seen: string[] = [];
  const cells = sweep.points.map((point, index) => {
    const signature = key(index);
    let slot = seen.indexOf(signature);
    if (slot === -1) {
      seen.push(signature);
      slot = seen.length - 1;
    }
    const hue = 205 + slot * 17;
    const repeat = index > 0 && key(index - 1) === signature;
    return `<div class="step${repeat ? " repeat" : ""}" style="--hue:${hue}" title="${escape(
      felt.map((n) => `${n}: ${point.readings[n]}`).join(" · "),
    )}"><span>${point.value}</span></div>`;
  });

  return `<div class="strip">${cells.join("")}</div>`;
}

/** A horizontal error bar for one dial's pre-registered axis. */
function effectBar(result: DialResult): string {
  const axis = result.axes.find(
    (row) => row.axis === (result.expectation.axis as JudgeAxis),
  );
  if (!axis) {
    return `<td colspan="2" class="muted">predicted no effect</td>`;
  }

  // A fixed −2…+2 window: every effect measured so far sits inside it, and a
  // window that rescales per row would make small effects look large.
  const span = 2;
  const pos = (value: number) =>
    ((Math.max(-span, Math.min(span, value)) + span) / (span * 2)) * 100;

  const [lo, hi] = axis.ci;
  const state = axis.separates ? (axis.difference > 0 ? "up" : "down") : "flat";

  return `<td class="barcell">
    <div class="bar ${state}">
      <div class="zero"></div>
      <div class="ci" style="left:${pos(lo)}%;width:${Math.max(0.8, pos(hi) - pos(lo))}%"></div>
      <div class="dot" style="left:${pos(axis.difference)}%"></div>
    </div>
  </td>
  <td class="num">${axis.difference >= 0 ? "+" : ""}${axis.difference.toFixed(1)}
    <span class="ci-text">[${lo.toFixed(1)}, ${hi.toFixed(1)}]</span></td>`;
}

export function renderHtml(
  deterministic: Deterministic,
  empirical: Empirical | null,
  provenance: string,
): string {
  const dialRows = deterministic.dials
    .map(
      (sweep) => `<tr>
      <th>${sweep.dial}</th>
      <td>${resolutionStrip(sweep)}</td>
      <td class="score ${sweep.distinctQuestioning === 10 ? "full" : "partial"}">
        ${sweep.distinctQuestioning}<span>/10</span>
      </td>
      <td class="muted">${
        sweep.plateaus.length
          ? `${sweep.plateaus.join(", ")} identical`
          : "every step differs"
      }</td>
    </tr>`,
    )
    .join("");

  const coverageRows = Object.entries(deterministic.coverage.shares)
    .map(
      ([strategy, share]) => `<tr>
        <th>${strategy.toLowerCase().replace(/_/g, " ")}</th>
        <td class="barcell"><div class="cbar" style="width:${(share * 100 * 3.4).toFixed(1)}%"></div></td>
        <td class="num">${(share * 100).toFixed(1)}%</td>
      </tr>`,
    )
    .join("");

  const liveRows = empirical
    ? empirical.dials
        .map(
          (result) => `<tr>
        <th>${result.dial}</th>
        <td class="muted">${result.expectation.axis ?? "no effect"}</td>
        ${effectBar(result)}
        <td class="verdict ${result.expectationHeld ? "held" : "no"}">${
          result.expectationHeld ? "held" : "not shown"
        }</td>
      </tr>`,
        )
        .join("")
    : "";

  return `<title>Persona dial evaluation</title>
<style>
  :root {
    --ink: #10151c; --muted: #5c6b7f; --line: #dfe5ec; --bg: #fbfcfd;
    --card: #ffffff; --accent: #1d6fd0; --up: #17795e; --down: #b0341d;
    --flat: #94a3b5;
  }
  :root:not([data-theme="light"]) {}
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ink: #e8edf4; --muted: #94a3b5; --line: #26303c; --bg: #0d1219;
      --card: #141b24; --accent: #6aa9f0; --up: #4cc79e; --down: #f0765a;
      --flat: #56657a;
    }
  }
  :root[data-theme="dark"] {
    --ink: #e8edf4; --muted: #94a3b5; --line: #26303c; --bg: #0d1219;
    --card: #141b24; --accent: #6aa9f0; --up: #4cc79e; --down: #f0765a;
    --flat: #56657a;
  }
  body {
    background: var(--bg); color: var(--ink); margin: 0;
    font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    padding-block: 40px; padding-left: 20px; padding-right: 20px;
  }
  main { max-width: 860px; margin: 0 auto; }
  h1 { font-size: 27px; letter-spacing: -0.02em; margin: 0 0 6px; text-wrap: balance; }
  h2 { font-size: 17px; letter-spacing: -0.01em; margin: 40px 0 6px; }
  p { margin: 0 0 14px; max-width: 66ch; color: var(--muted); }
  p.lead { color: var(--ink); }
  .prov {
    font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
    color: var(--muted); border-left: 2px solid var(--line);
    padding-left: 10px; margin-bottom: 28px;
  }
  section {
    background: var(--card); border: 1px solid var(--line);
    border-radius: 10px; padding: 18px 20px; margin-bottom: 8px;
    overflow-x: auto;
  }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th { text-align: left; font-weight: 600; white-space: nowrap; padding-right: 14px; }
  td { padding: 5px 10px 5px 0; vertical-align: middle; }
  tbody th { padding: 5px 14px 5px 0; }
  .muted { color: var(--muted); font-size: 13px; }
  .num {
    font: 13px ui-monospace, SFMono-Regular, Menlo, monospace;
    font-variant-numeric: tabular-nums; white-space: nowrap;
  }
  .ci-text { color: var(--muted); }
  .strip { display: flex; gap: 2px; min-width: 260px; }
  .step {
    flex: 1; height: 26px; border-radius: 3px; display: grid; place-items: center;
    background: hsl(var(--hue) 62% 58%); color: #fff; font-size: 11px;
    font-variant-numeric: tabular-nums;
  }
  .step.repeat { opacity: 0.42; }
  .score { font: 600 17px ui-monospace, Menlo, monospace; white-space: nowrap; }
  .score span { font-size: 12px; font-weight: 400; color: var(--muted); }
  .score.full { color: var(--up); }
  .score.partial { color: var(--accent); }
  .barcell { width: 200px; min-width: 150px; }
  .bar { position: relative; height: 22px; }
  .zero {
    position: absolute; left: 50%; top: 0; bottom: 0; width: 1px;
    background: var(--line);
  }
  .ci { position: absolute; top: 9px; height: 4px; border-radius: 2px; background: var(--flat); }
  .dot {
    position: absolute; top: 5px; width: 11px; height: 11px; margin-left: -5px;
    border-radius: 50%; background: var(--flat);
  }
  .bar.up .ci, .bar.up .dot { background: var(--up); }
  .bar.down .ci, .bar.down .dot { background: var(--down); }
  .cbar { height: 13px; border-radius: 2px; background: var(--accent); min-width: 2px; }
  .verdict { font-size: 12px; font-weight: 600; white-space: nowrap; }
  .verdict.held { color: var(--up); }
  .verdict.no { color: var(--muted); }
  footer { color: var(--muted); font-size: 13px; margin-top: 36px; }
  @media (max-width: 620px) {
    .barcell { width: 120px; min-width: 100px; }
    .strip { min-width: 200px; }
  }
</style>
<main>
  <h1>Do the persona dials change the interview?</h1>
  <p class="lead">Six sliders, 1 to 10. This is what each one measurably does.</p>
  <p class="prov">${escape(provenance)}</p>

  <h2>1. What the dial changes &mdash; measured offline</h2>
  <p>
    Each dial swept 1&ndash;10 with the other five held at 5. A block is one
    setting; faded blocks behave identically to the one before them. Free,
    offline, and identical on every run.
  </p>
  <section>
    <table><tbody>${dialRows}</tbody></table>
  </section>

  <h2>2. Which moves the interviewer uses</h2>
  <p>
    ${deterministic.coverage.distinctStrategies} of 9 strategies, over
    ${deterministic.coverage.decisions.toLocaleString()} decisions across eight
    answer qualities. Within one answer quality the move is near-fixed &mdash; a
    weakness outranks a dial, deliberately &mdash; so variety comes from the
    candidate's answers changing, not from the dials.
  </p>
  <section>
    <table><tbody>${coverageRows}</tbody></table>
  </section>

  ${
    empirical
      ? `<h2>3. Whether it reaches the model &mdash; measured live</h2>
  <p>
    ${empirical.runs} generated follow-ups per cell, each rated by a judge never
    told the persona, the dial or the level. The bar is the change from dial 2 to
    dial 9 on the axis predicted <em>before</em> the run; the line is the 95%
    interval. An interval crossing the centre means this sample cannot tell.
  </p>
  <section>
    <table><tbody>${liveRows}</tbody></table>
  </section>
  <p class="muted">
    ${empirical.model} as interviewer, ${empirical.judgeModel} as judge.
    This run cost $${empirical.costUsd.toFixed(3)}.
  </p>`
      : ""
  }

  <footer>
    Generated by <code>npm run eval:persona -- --artifacts</code>. Full method,
    limitations and what this does not prove: <code>docs/PERSONA-EVAL.md</code>.
    Probe-rate baseline: ${escape(deterministic.probeBaseline)}.
  </footer>
</main>`;
}
