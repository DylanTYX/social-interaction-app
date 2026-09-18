/**
 * The persona evaluation as a page that answers its own question.
 *
 * The first version of this showed the data and left the reader to work out
 * what it meant: ten rainbow blocks encoding "distinct outcome" without saying
 * distinct in what, and error bars with no axis. Both were faithful to the
 * numbers and unreadable, which is a failure — an examiner who will not read a
 * 250-line report will not decode a chart either.
 *
 * So the page leads with the verdict, states each dial's effect as a quantity a
 * person recognises ("accepts an answer scoring 45/100 → 90/100" rather than
 * "10 distinct outcomes"), and puts one plain sentence above every chart saying
 * how to read it. The detail stays in `PERSONA-EVAL.md`; this is the part that
 * has to survive being glanced at.
 *
 * **Generated, never hand-written**, from the same objects the JSON artifact is
 * serialised from. Self-contained — no scripts, no fonts, no network — so it
 * opens from a file:// URL and still draws in a year.
 */

import type { DialSweep, StrategyCoverage } from "./persona-sweeps";
import type { DialResult } from "./persona-experiment";

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

/** Small numbers read better as words in a sentence than as numerals. */
const WORDS = ["none", "one", "two", "three", "four", "five", "six"];
const word = (n: number) => WORDS[n] ?? String(n);
const Word = (n: number) => {
  const w = word(n);
  return w.charAt(0).toUpperCase() + w.slice(1);
};

const escape = (value: string) =>
  value.replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string,
  );

/** The headline quantity as a line, so a trend is seen rather than counted. */
function sparkline(values: number[]): string {
  const w = 132;
  const h = 34;
  const pad = 4;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const range = hi - lo || 1;

  const pt = (value: number, index: number) => {
    const x = pad + (index / (values.length - 1)) * (w - pad * 2);
    const y = h - pad - ((value - lo) / range) * (h - pad * 2);
    return [x, y] as const;
  };

  const points = values.map(pt);
  const path = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const dots = points
    .map(
      ([x, y], i) =>
        `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${
          i === 0 || i === values.length - 1 ? 2.8 : 1.8
        }"/>`,
    )
    .join("");

  return `<svg class="spark" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true">
    <polyline points="${path}"/>${dots}
  </svg>`;
}

/**
 * The axis, as a table header row.
 *
 * It has to live inside the table, in the same column as the bars: as a
 * free-standing div above the table it spanned the full width while the bars
 * occupied one narrow cell, so "+1" sat nowhere near +1. An axis that does not
 * line up with its data is worse than no axis, because it is believed.
 */
function effectAxis(span: number): string {
  const ticks = [-1, 0, 1, 2, 3].filter((t) => Math.abs(t) <= span);
  const marks = ticks
    .map((t) => {
      const left = ((t + span) / (span * 2)) * 100;
      // Numerals only. "no change" spelled out at the centre was wider than
      // the space between ticks and collided with its neighbours; the sentence
      // above the chart already says what the centre line means.
      return `<span class="tick${t === 0 ? " zero" : ""}" style="left:${left}%">${
        t > 0 ? `+${t}` : t
      }</span>`;
    })
    .join("");

  return `<thead><tr class="axisrow">
    <th></th><td></td>
    <td class="barcell"><div class="axis">${marks}</div></td>
    <td colspan="2"></td>
  </tr></thead>`;
}

function effectRow(result: DialResult, span: number): string {
  const axis = result.axes.find((row) => row.axis === result.expectation.axis);
  const held = result.expectationHeld;

  if (!axis) {
    return `<tr>
      <th>${result.dial}</th>
      <td class="what">no effect predicted &mdash; its lever is the speech rate</td>
      <td class="barcell"><div class="bar"><div class="zero"></div></div></td>
      <td class="num muted">&mdash;</td>
      <td class="verdict ${held ? "yes" : "no"}">${held ? "confirmed" : "unexpected effect"}</td>
    </tr>`;
  }

  const pos = (value: number) =>
    ((Math.max(-span, Math.min(span, value)) + span) / (span * 2)) * 100;
  const [lo, hi] = axis.ci;
  const real = axis.separates;

  return `<tr>
    <th>${result.dial}</th>
    <td class="what">more <strong>${axis.axis.replace(/([A-Z])/g, " $1").toLowerCase()}</strong></td>
    <td class="barcell">
      <div class="bar ${real ? "real" : "unclear"}">
        <div class="zero"></div>
        <div class="ci" style="left:${pos(lo)}%;width:${Math.max(1, pos(hi) - pos(lo))}%"></div>
        <div class="dot" style="left:${pos(axis.difference)}%"></div>
      </div>
    </td>
    <td class="num">${axis.difference >= 0 ? "+" : ""}${axis.difference.toFixed(1)}</td>
    <td class="verdict ${held ? "yes" : "no"}">${held ? "confirmed" : "can't tell"}</td>
  </tr>`;
}

export function renderHtml(
  deterministic: Deterministic,
  empirical: Empirical | null,
  provenance: string,
): string {
  const dials = deterministic.dials;
  const fullyResolved = dials.filter((d) => d.distinctQuestioning === 10).length;
  const confirmed = empirical?.dials.filter((d) => d.expectationHeld).length ?? 0;
  const span = 3;

  const dialRows = dials
    .map((sweep) => {
      const { label, values, unit } = sweep.headline;
      const first = values[0];
      const last = values[values.length - 1];
      return `<tr>
        <th>${sweep.dial}</th>
        <td class="what">${label}</td>
        <td class="sparkcell">${sparkline(values)}</td>
        <td class="num range">${first}${escape(unit)} <span class="arrow">&rarr;</span> ${last}${escape(unit)}</td>
        <td class="settings ${sweep.distinctQuestioning === 10 ? "full" : "partial"}">
          ${sweep.distinctQuestioning}<span>/10</span>
        </td>
      </tr>`;
    })
    .join("");

  const plateaus = dials
    .filter((d) => d.plateaus.length)
    .map((d) => `${d.dial} ${d.plateaus.join(" and ")}`)
    .join("; ");

  const coverageRows = Object.entries(deterministic.coverage.shares)
    .map(
      ([strategy, share]) => `<tr>
        <th class="move">${strategy.toLowerCase().replace(/_/g, " ")}</th>
        <td class="barcell"><div class="cbar" style="width:${(share * 340).toFixed(1)}%"></div></td>
        <td class="num">${(share * 100).toFixed(1)}%</td>
      </tr>`,
    )
    .join("");

  return `<title>Persona dial evaluation</title>
<style>
  :root {
    --ink: #151a21; --soft: #5a6676; --line: #e2e7ee; --bg: #f6f8fa;
    --card: #fff; --data: #35648f; --real: #146b52; --unclear: #97a1b0;
    --rule: #eef1f5;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ink: #e9eef5; --soft: #96a2b3; --line: #253040; --bg: #0e1319;
      --card: #161c25; --data: #74a8d8; --real: #45c39b; --unclear: #5d6a7c;
      --rule: #1e2734;
    }
  }
  :root[data-theme="dark"] {
    --ink: #e9eef5; --soft: #96a2b3; --line: #253040; --bg: #0e1319;
    --card: #161c25; --data: #74a8d8; --real: #45c39b; --unclear: #5d6a7c;
    --rule: #1e2734;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: var(--bg); color: var(--ink);
    font: 15px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    padding-block: 48px; padding-left: 20px; padding-right: 20px;
    -webkit-font-smoothing: antialiased;
  }
  main { max-width: 800px; margin: 0 auto; }
  h1 {
    font-size: 30px; line-height: 1.2; letter-spacing: -0.025em;
    margin: 0 0 14px; text-wrap: balance; font-weight: 650;
  }
  h2 {
    font-size: 13px; letter-spacing: 0.07em; text-transform: uppercase;
    color: var(--soft); margin: 46px 0 8px; font-weight: 650;
  }
  p { margin: 0 0 16px; max-width: 64ch; }
  .verdict-note { font-size: 17px; line-height: 1.55; margin-bottom: 26px; }
  .verdict-note strong { font-weight: 650; }
  .howto {
    color: var(--soft); font-size: 14px; margin-bottom: 14px; max-width: 64ch;
  }
  section {
    background: var(--card); border: 1px solid var(--line); border-radius: 12px;
    padding: 8px 20px; overflow-x: auto;
  }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  tr + tr { border-top: 1px solid var(--rule); }
  th {
    text-align: left; font-weight: 600; white-space: nowrap;
    padding: 11px 16px 11px 0;
  }
  th.move { font-weight: 500; }
  td { padding: 11px 14px 11px 0; vertical-align: middle; }
  .what { color: var(--soft); font-size: 13.5px; }
  .what strong { color: var(--ink); font-weight: 600; }
  .num {
    font: 13px ui-monospace, SFMono-Regular, Menlo, monospace;
    font-variant-numeric: tabular-nums; white-space: nowrap; text-align: right;
  }
  .range { color: var(--ink); }
  .arrow { color: var(--soft); padding: 0 1px; }
  .sparkcell { width: 140px; }
  .spark { display: block; overflow: visible; }
  .spark polyline { fill: none; stroke: var(--data); stroke-width: 1.6; }
  .spark circle { fill: var(--data); }
  .settings {
    font: 600 16px ui-monospace, Menlo, monospace; text-align: right;
    white-space: nowrap; font-variant-numeric: tabular-nums;
  }
  .settings span { font-size: 11px; font-weight: 400; color: var(--soft); }
  .settings.full { color: var(--real); }
  .settings.partial { color: var(--data); }
  .axisrow td, .axisrow th { padding-top: 6px; padding-bottom: 0; border: 0; }
  .axis { position: relative; height: 15px; }
  .axis .tick {
    position: absolute; transform: translateX(-50%); font-size: 11px;
    color: var(--soft); white-space: nowrap;
  }
  .axis .tick.zero { color: var(--ink); font-weight: 600; }
  .barcell { width: 236px; min-width: 150px; }
  .bar { position: relative; height: 20px; }
  .zero {
    position: absolute; left: 50%; top: -4px; bottom: -4px; width: 1px;
    background: var(--line);
  }
  .ci { position: absolute; top: 8px; height: 4px; border-radius: 2px; background: var(--unclear); }
  .dot {
    position: absolute; top: 4px; width: 12px; height: 12px; margin-left: -6px;
    border-radius: 50%; background: var(--unclear);
  }
  .bar.real .ci, .bar.real .dot { background: var(--real); }
  .cbar {
    height: 11px; border-radius: 2px; background: var(--data);
    min-width: 3px; opacity: 0.8;
  }
  .verdict { font-size: 12.5px; font-weight: 600; white-space: nowrap; text-align: right; }
  .verdict.yes { color: var(--real); }
  .verdict.no { color: var(--soft); }
  .muted { color: var(--soft); }
  .caveat {
    margin-top: 14px; font-size: 13.5px; color: var(--soft);
    border-left: 2px solid var(--line); padding-left: 12px; max-width: 64ch;
  }
  footer {
    margin-top: 50px; padding-top: 18px; border-top: 1px solid var(--line);
    font-size: 12.5px; color: var(--soft);
  }
  footer code { font-size: 12px; }
  @media (max-width: 640px) {
    .sparkcell, .what { display: none; }
    .barcell { width: 130px; min-width: 110px; }
  }
</style>
<main>
  <h1>Do the persona dials change the interview?</h1>
  <p class="verdict-note">
    <strong>Yes.</strong> ${Word(fullyResolved)} of the six sliders produce a
    different interviewer at every one of their ten settings${
      fullyResolved === dials.length
        ? ""
        : `, and the ${
            dials.length - fullyResolved === 1 ? "sixth at nine of ten" : "others at nine of ten"
          }`
    }.${
      empirical
        ? ` Asked to run real interviews under them, a language model changed its
    questions as predicted for ${word(confirmed)} of the six &mdash; predictions
    written down before the run.`
        : ""
    }
  </p>

  <h2>1 &middot; Turn the dial, and this changes</h2>
  <p class="howto">
    Each row is one slider moved from 1 to 10 with the other five held at the
    middle. The line is the quantity it controls; the last column counts how many
    of the ten settings produce an interviewer that behaves differently from the
    one before it.
  </p>
  <section><table><tbody>${dialRows}</tbody></table></section>
  ${
    plateaus
      ? `<p class="caveat">
    Not every step does something: ${escape(plateaus)} behave identically,
    because those settings land on the same internal threshold. Published rather
    than smoothed over &mdash; anyone can nudge a slider by one and see.
  </p>`
      : ""
  }

  ${
    empirical
      ? `<h2>2 &middot; Does the model actually obey?</h2>
  <p class="howto">
    ${empirical.runs} interview questions generated at each setting, then rated by
    a second model that was never told which persona wrote them. The dot is how
    much the rating moved between dial 2 and dial 9; the line around it is the
    range the measurement is confident about. <strong>Clear of the centre means
    the dial really changed the interview.</strong> Crossing it means this many
    samples cannot tell.
  </p>
  <section>
    <table>
      ${effectAxis(span)}
      <tbody>${empirical.dials.map((row) => effectRow(row, span)).join("")}</tbody>
    </table>
  </section>
  <p class="caveat">
    Tested at settings 2, 5 and 9 &mdash; so this shows the ends of a slider are
    distinguishable, not that 8 differs from 9.
  </p>`
      : ""
  }

  <h2>3 &middot; Which questions the interviewer reaches for</h2>
  <p class="howto">
    Across ${deterministic.coverage.decisions.toLocaleString()} decisions over
    answers of every quality, it uses
    ${deterministic.coverage.distinctStrategies} of its 9 moves &mdash; it is not a
    one-note questioner. But which move it picks is decided by the weakness in
    the answer, not by the dials: the dials change how hard it presses, not what
    it presses on.
  </p>
  <section><table><tbody>${coverageRows}</tbody></table></section>

  <footer>
    ${escape(provenance)}<br>
    ${
      empirical
        ? `${escape(empirical.model)} interviewing, ${escape(empirical.judgeModel)} judging; this run cost $${empirical.costUsd.toFixed(3)}. `
        : ""
    }Probe-rate baseline ${escape(deterministic.probeBaseline)}.
    Method, limitations and what this does <em>not</em> prove:
    <code>docs/PERSONA-EVAL.md</code>. Regenerate with
    <code>npm run eval:persona -- --artifacts</code>.
  </footer>
</main>`;
}
