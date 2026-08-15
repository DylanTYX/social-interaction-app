/**
 * Statistics shared by the eval harnesses.
 *
 * `mean` and `stdDev` were copy-pasted in `run-eval.ts` and
 * `run-persona-eval.ts` already; `run-coach-eval.ts` would have been the third.
 *
 * The rest exists because the coach harness makes a *paired* claim — the same
 * answer scored before and after coaching — on 18 samples. At that size an
 * approximate test is not quotable, so the sign test here is exact and the
 * confidence interval is a seeded bootstrap that reproduces run to run.
 *
 * Developer tooling. Never imported by `src/app` or `src/components`; eslint
 * enforces that from the other side.
 */

export function mean(values: number[]): number {
  return values.length
    ? values.reduce((a, b) => a + b, 0) / values.length
    : Number.NaN;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/**
 * Cohen's d for paired samples: mean difference over the sd of the differences.
 *
 * Paired rather than pooled because every difference here is one fixture
 * measured twice, so between-fixture variance is not error — it is the thing
 * pairing removes.
 */
export function pairedCohensD(differences: number[]): number {
  const sd = stdDev(differences);
  return sd === 0 ? Number.NaN : mean(differences) / sd;
}

function logFactorial(n: number): number {
  let total = 0;
  for (let i = 2; i <= n; i += 1) total += Math.log(i);
  return total;
}

function binomialPmf(k: number, n: number): number {
  return Math.exp(
    logFactorial(n) -
      logFactorial(k) -
      logFactorial(n - k) -
      n * Math.LN2, // p = 0.5, so p^k (1-p)^(n-k) = 2^-n
  );
}

/**
 * Exact two-sided binomial sign test at p = 0.5.
 *
 * Exact rather than normal-approximated: n is 18. The approximation needs
 * n·p ≥ 5 on both tails to be trustworthy and would be quoted to three decimal
 * places it has not earned. Computed in log space so the factorials do not
 * overflow if the fixture set ever grows.
 *
 * Ties (a difference of exactly zero) must be excluded by the caller and `n`
 * reduced accordingly — that is the standard treatment, and counting a tie as
 * a success would inflate the result.
 */
export function signTestP(successes: number, n: number): number {
  if (n === 0) return Number.NaN;

  const extreme = Math.max(successes, n - successes);
  let tail = 0;
  for (let k = extreme; k <= n; k += 1) tail += binomialPmf(k, n);

  return Math.min(1, 2 * tail);
}

/** Deterministic PRNG, so a reported confidence interval reproduces exactly. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Percentile bootstrap CI for the mean.
 *
 * Seeded deliberately. An unseeded bootstrap gives a slightly different
 * interval every time it runs, which makes a committed artifact impossible to
 * check — and a number a reader cannot reproduce is a number they are being
 * asked to take on trust.
 */
export function bootstrapCI(
  values: number[],
  { draws = 5000, seed = 20260816, level = 0.95 } = {},
): [number, number] {
  if (values.length < 2) return [Number.NaN, Number.NaN];

  const random = mulberry32(seed);
  const means: number[] = [];

  for (let d = 0; d < draws; d += 1) {
    let total = 0;
    for (let i = 0; i < values.length; i += 1) {
      total += values[Math.floor(random() * values.length)];
    }
    means.push(total / values.length);
  }

  means.sort((a, b) => a - b);
  const alpha = (1 - level) / 2;
  const lo = means[Math.floor(alpha * draws)];
  const hi = means[Math.min(draws - 1, Math.ceil((1 - alpha) * draws) - 1)];
  return [lo, hi];
}

/**
 * Pearson correlation.
 *
 * Used for exactly one question in the coach harness, and it is the question
 * that can invalidate the headline: is the score uplift explained by the
 * rewrite simply being longer? A high r there means the uplift belongs to the
 * analyzer's length sensitivity rather than to the coaching.
 */
export function pearson(xs: number[], ys: number[]): number {
  if (xs.length !== ys.length || xs.length < 2) return Number.NaN;

  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;

  for (let i = 0; i < xs.length; i += 1) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }

  return dx === 0 || dy === 0 ? Number.NaN : num / Math.sqrt(dx * dy);
}
