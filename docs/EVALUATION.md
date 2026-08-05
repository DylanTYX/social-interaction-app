# Evaluating the analyzer

The interviewer adapts based on a score. If that score is wrong, or if it is
unstable enough that the same answer lands in a different band on a second run,
then everything built on top of it — the decision engine, the steering block,
the report, the competency coverage — is built on sand.

This document is how that claim gets checked rather than asserted.

> **Status: methodology complete, results not yet collected.**
> The harness runs against the live OpenAI API and costs real money, so it has
> to be run deliberately. The command is in [Running it](#running-it) and the
> tables below have the shape the results go in.

---

## What is being measured

`npm run eval` scores a golden set of hand-written answers, each authored to sit
in a known quality band, and reports four things.

### 1. Band accuracy

Does the analyzer put an answer in the right band?

Bands are defined in [`src/eval/fixtures.ts`](../src/eval/fixtures.ts) and
deliberately **overlap**:

| Band | Range |
|---|---|
| weak | 0–45 |
| mediocre | 40–72 |
| strong | 68–100 |

The overlap is the point. A "strong" answer scoring 70 and a "mediocre" one
scoring 71 is not a failure — human interviewers do not agree to the point
either. What would be a failure is a strong answer scoring 40. Accuracy measures
*usable* agreement, not exact agreement.

### 2. Stability across runs

The analyzer runs at `temperature: 0.1` and the code has always described that
as near-deterministic. This measures whether that is true, by scoring each
fixture N times and reporting the standard deviation.

This matters more than accuracy for the product. A candidate who re-runs the
same practice answer and gets 62 then 78 will not trust anything the app says.

### 3. Separation

The gap between the mean of the strong fixtures and the mean of the weak ones.

If strong and weak do not pull apart, nothing else about the scoring matters —
the analyzer would be producing numbers that look like judgement without being
judgement.

### 4. Field completeness

How often the model omits a field it was asked for.

This is why `jsonrepair` is a dependency. It is also why the analyzer has a
`finish_reason === "length"` check and a retry: a truncated response is
*almost* valid JSON, and without the check it failed as a generic parse error
that named the wrong cause.

Note the check narrowed deliberately. Six fields — word count, hesitation
markers, qualifiers, self-corrections, metric count, timeframes — moved to
[`text-metrics.ts`](../src/lib/text-metrics.ts) and are now computed in code, so
they can no longer be missing. The harness checks the leaf fields the model is
still responsible for (`vaguenessScore`, `assertivenessScore`, `depthLevel` and
the rest) rather than their container objects, which are now always present.

---

## Coverage

18 fixtures across all six round types:

| Round type | Fixtures |
|---|---|
| behavioral | 5 |
| technical_swe | 3 |
| system_design | 3 |
| screening | 2 |
| case | 2 |
| hr | 3 |

Each fixture carries a `rationale` explaining why it belongs in its band. That
is not decoration — it is the thing a marker can check. If you disagree with a
fixture's rationale, the fixture is wrong, and a disagreement about the fixture
is more useful than a disagreement about the score.

---

## Running it

```bash
npm run eval                  # 3 runs per fixture
npm run eval -- --runs=5      # tighter variance estimate
npm run eval -- --json        # machine-readable
npm run eval -- --only=hr     # filter by id substring or round type
```

Cost is `fixtures × runs` analyzer calls: 18 × 5 = 90 calls, a few cents at
`gpt-4o-mini` pricing. It needs `OPENAI_API_KEY` in `.env.local`.

Capture the output:

```bash
npm run eval -- --runs=5 --json > docs/eval-results.json
```

---

## Results

### Before / after: moving counting out of the LLM

The analyzer used to ask the model for six countable fields. Those moved to
code, which shrank the request scaffold from ~296 to ~245 tokens and removed six
fields from the response.

The saving is not the interesting part — it is small. The interesting part is
whether a smaller schema changed how the model assigns `overallScore`. A schema
change that quietly degrades scoring is a bad trade at any price, and this is
the only measurement that can tell the difference.

Run the harness at `9cf6024~1` and at `HEAD`, and record both:

| Metric | Before (`9cf6024~1`) | After (`HEAD`) | Verdict |
|---|---|---|---|
| Band accuracy | _pending_ | _pending_ | must not drop |
| Mean std dev across runs | _pending_ | _pending_ | must not rise |
| Strong/weak separation | _pending_ | _pending_ | must not narrow |
| Field completeness | _pending_ | _pending_ | — |

**If band accuracy drops, revert the change and say so.** A ~17% scaffold
reduction is not worth worse scoring, and reporting a reverted experiment is
worth more marks than not running it.

### Per-round-type accuracy

Worth breaking out, because the round types are not equally easy. HR and
screening are judged on motivation and fit, which is softer than correctness and
complexity — expect lower agreement there, and say so rather than hiding it in
an average.

| Round type | Fixtures | Band accuracy | Mean std dev |
|---|---|---|---|
| behavioral | 5 | _pending_ | _pending_ |
| technical_swe | 3 | _pending_ | _pending_ |
| system_design | 3 | _pending_ | _pending_ |
| screening | 2 | _pending_ | _pending_ |
| case | 2 | _pending_ | _pending_ |
| hr | 3 | _pending_ | _pending_ |

---

## Limitations worth stating

An evaluator will find these anyway; better to name them.

- **18 fixtures is a small sample.** Enough to catch a systemic failure — a
  round type scored against the wrong rubric, a band inversion — and not enough
  for a confidence interval on accuracy.
- **The fixtures are author-written, not collected from real candidates.** They
  are constructed to sit cleanly in a band, so they are probably easier to
  classify than real answers, which cluster in the middle.
- **Band assignment is one person's judgement.** There is no second annotator,
  so there is no inter-rater agreement figure. A stronger design would have two
  people band the fixtures independently and report Cohen's kappa first.
- **This measures the analyzer, not the interview.** Whether the *questions* are
  good, whether the adaptation helps a candidate improve, and whether the app
  teaches anything are separate questions — that is what
  [`UAT.md`](UAT.md) is for.
- **Nothing here has been validated against live traffic.** See
  [`TOKEN-COST.md`](TOKEN-COST.md) for the same caveat on the cost figures.
