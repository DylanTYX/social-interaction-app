# Evaluating the analyzer

The interviewer adapts based on a score. If that score is wrong, or if it is
unstable enough that the same answer lands in a different band on a second run,
then everything built on top of it — the decision engine, the steering block,
the report, the competency coverage — is built on sand.

This document is how that claim gets checked rather than asserted.

> **Status: analyzer measured on its current model, human validation
> outstanding.** Re-run on 19 October 2026 on `gpt-6-luna`, which replaced
> `gpt-4o-mini`: 81.1% band accuracy and 43.7 separation, against 55.6% and
> 11.7 for a keyword baseline (five runs of each of 18 fixtures). The earlier
> 88.9% and 41.0 were measured in August on `gpt-4o-mini`, before two fixtures
> were replaced and a language-signals block entered the prompt; they are kept
> below as history, and the same tree re-measured on `gpt-4o-mini` gave 81.1%
> and 36.6. What has _not_ been collected is the inter-rater pass, so every
> accuracy figure below still means "agreement with one person". See
> [the inter-rater pass](#the-inter-rater-pass).

---

## What is being measured

`npm run eval` scores a golden set of hand-written answers, each authored to sit
in a known quality band, and reports four things.

### 1. Band accuracy

Does the analyzer put an answer in the right band?

Bands are defined in [`src/eval/fixtures.ts`](../src/eval/fixtures.ts) and
deliberately **overlap**:

| Band     | Range  |
| -------- | ------ |
| weak     | 0–45   |
| mediocre | 40–72  |
| strong   | 68–100 |

The overlap is the point. A "strong" answer scoring 70 and a "mediocre" one
scoring 71 is not a failure — human interviewers do not agree to the point
either. What would be a failure is a strong answer scoring 40. Accuracy measures
_usable_ agreement, not exact agreement.

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
_almost_ valid JSON, and without the check it failed as a generic parse error
that named the wrong cause.

Note the check narrowed deliberately. Six fields — word count, hesitation
markers, qualifiers, self-corrections, metric count, timeframes — moved to
[`text-metrics.ts`](../src/lib/text-metrics.ts) and are now computed in code, so
they can no longer be missing.

The remaining judgement fields carry neutral defaults, so the product never sees
an undefined score. That would make the finished object complete by
construction and the metric meaningless, so `analyzeResponse` reports an
`omittedFields` list recording what the model actually left out _before_ the
defaults fill it in. The harness reads that. It is diagnostic only — nothing in
the product consumes it.

---

## Coverage

18 fixtures across all six round types:

| Round type    | Fixtures |
| ------------- | -------- |
| behavioral    | 5        |
| technical_swe | 3        |
| system_design | 3        |
| screening     | 2        |
| cs_fundamentals | 2      |
| hr            | 3        |

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

Cost is `fixtures × runs` analyzer calls: 18 × 5 = 90 calls, about three cents
(a run cost $0.027 on `gpt-6-luna` and $0.030 on `gpt-4o-mini`). It needs
`OPENAI_API_KEY` in `.env.local`, and `npm run eval:models` checks that the key
and the configured models are accepted before any billed run.

Capture the output. `npm run eval` prints to stdout and writes nothing itself,
so a run that is not redirected leaves no evidence behind — which is how the
harness ended up built and never recorded.

The run names the analyzer model in its first line, prints a notice if that
model has an announced retirement date, and exits non-zero when any call
failed. It did not always: with a rejected key, every fixture used to print
PASS (0 of 0 scores in band) beside a NaN mean, and the process exited 0.

```bash
# Human-readable; name the file after the model it measured
npm run eval -- --runs=5 | tee docs/artifacts/eval-gpt-6-luna.txt

# The same tree on another model, for a comparison
ANALYZER_MODEL=gpt-4o-mini npm run eval -- --runs=5 | tee docs/artifacts/eval-gpt-4o-mini.txt

# Machine-readable, for tables in the report
npm run eval -- --runs=5 --json > docs/artifacts/eval-results.json
```

Commit both. The numbers in the Results section below are only claims until the
run that produced them is in the repository.

### The inter-rater pass

```bash
npm run eval:raters                     # the blind marking sheet, for the raters
npm run eval:raters -- --key            # fixture ids and labels, collator only
npm run eval:raters -- --score=r.json   # agreement report
```

Calls no API and costs nothing. Give the sheet to two or three people who have
not seen the labels, collect their numbers, and enter the analyzer's own mean
scores from `npm run eval` as one more rater in the same file — it is then held
to exactly the comparison the people are.

The sheet is presented in a hashed order, not file order, because `FIXTURES` is
grouped by round type and cycles strong/weak/mediocre; a rater working down it
in file order could infer the intended band from the position. The order is
stable across prints so two raters' sheets line up.

What comes back:

- **Band agreement and Cohen's kappa** per rater against the labels, and for
  every pair of raters. Kappa rather than raw agreement, because two raters who
  both call everything "mediocre" agree 100% of the time and have measured
  nothing.
- **Contested answers** — the ones the raters agree on and the label does not.
  These are labels to move.
- **Disputed answers** — the ones the raters cannot agree on between themselves.
  These are fixtures whose band was never well defined.

The decision rule, fixed in advance so the result cannot be read to suit:

| Raters agree with…             | Conclusion                  | Action                      |
| ------------------------------ | --------------------------- | --------------------------- |
| analyzer, not label            | the labels are wrong        | move the band, document it  |
| label, not analyzer            | the analyzer is too lenient | change the prompt           |
| neither / each other disagrees | the fixture is ambiguous    | rewrite or drop the fixture |

---

## Reading the metrics

The harness reports six things. They answer different questions and the first
two are easy to confuse:

| Metric             | Question it answers                                                |
| ------------------ | ------------------------------------------------------------------ |
| **Separation**     | Does it tell a strong answer from a weak one _at all_?             |
| **Band accuracy**  | Does it agree with the hand-assigned label?                        |
| **Std dev**        | Does it give the same answer twice? (reliability)                  |
| **By round type**  | Where does it agree, and where does it not?                        |
| **Miss direction** | Is it systematically lenient or harsh?                             |
| **Band spread**    | Is the band itself coherent, or does it hold two different things? |

**Separation leads, and that is a deliberate choice.** Band accuracy buckets a
0-100 judgement into three classes and throws the magnitude away — and the
middle band is wide (40-72), so a scorer that clusters everything near 60
collects hits it has not earned. The keyword heuristic does precisely that: it
lands **55.6%** of fixtures in the right band while pulling strong and weak
apart by only **11.7 points** (13.0 in August, before two fixtures changed),
against the analyzer's **43.7**.

The reason this ordering was adopted is worth keeping, because it was not
obvious at the time. On the pre-anchoring run the analyzer scored **63.0%**
band accuracy against the heuristic's 55.6% — judged on that column alone, a
month of prompt work looked 7 points better than a regex. On separation the same
run was 36.4 against 13.0, nearly three times better. The second reading was the
correct one, and the fixtures' own docstring agrees: the claim under test is
"this separates a strong answer from a weak one", not "this predicts 73".

## Known limits of this harness

State these rather than let a reader find them:

- **18 fixtures**, roughly six per band and two to four per round type. One
  fixture flipping moves band accuracy by 5.6 points, so any change smaller
  than about 11 points is inside the noise.
- **The labels are one person's judgement and have not been validated.** Band
  accuracy therefore measures _agreement with the author_, not accuracy. This is
  no longer only a caveat — it is the open question behind the remaining
  misses, every one of which is lenient, and `npm run eval:raters` prints the
  sheet that settles it. Until
  that has been run with real markers, every accuracy figure here means
  "agreement with one person".
- **It tests the analyzer only.** Not the interviewer's questions, not persona
  behaviour, not follow-up adaptivity, not the summariser. The coach used to be
  on this list too; it now has its own harness and its own document — see
  [`COACHING.md`](COACHING.md) and `npm run eval:coach`. That harness uses *this*
  analyzer as its scorer, which is a weaker form of evidence than it looks;
  COACHING.md says why at length.
- **The answers, the labels and the rubric all come from the same author**, so
  this measures internal consistency more than external validity.
- **The figures belong to one model.** The same tree scored 88.9% in August,
  81.1% on `gpt-4o-mini` in October and 81.1% on `gpt-6-luna`, with different
  misses each time; a model change is therefore not a deployment detail but a
  new measurement, and `npm run eval:models` followed by `npm run eval` is the
  procedure for it.

## Results

### Model migration, October 2026: `gpt-4o-mini` to `gpt-6-luna`

OpenAI retires `gpt-4o-mini` on 14 January 2027. The assessor moved to
`gpt-6-luna` on 19 October 2026, after this comparison: the same tree, the same
18 fixtures, five runs of each, one run per model
([`eval-gpt-4o-mini.txt`](artifacts/eval-gpt-4o-mini.txt),
[`eval-gpt-6-luna.txt`](artifacts/eval-gpt-6-luna.txt)). The pass criteria were
written down first, in [TOKEN-COST.md](TOKEN-COST.md): band accuracy and
separation at or above the old model, mean standard deviation no more than 0.5
worse, field completeness unchanged, and the two fluent-but-wrong fixtures no
more lenient.

| Metric                      | `gpt-4o-mini` | `gpt-6-luna`  | Criterion          |
| --------------------------- | ------------- | ------------- | ------------------ |
| Band accuracy               | 81.1% (73/90) | 81.1% (73/90) | not lower — met    |
| **Separation**              | 36.6          | **43.7**      | not narrower — met |
| Strong mean / weak mean     | 76.5 / 39.8   | 83.4 / 39.8   |                    |
| Mean std dev across runs    | 2.01          | **1.36**      | within +0.5 — met  |
| Worst std dev               | 8.37          | 2.95          |                    |
| Field completeness          | 100%          | 100%          | unchanged — met    |
| Separation vs keyword       | 3.1×          | 3.7×          |                    |
| `tech-weak-code` (fluent, wrong) | 50.4, 0/5 in band | 44.8, 3/5 in band | no more lenient — met |
| `design-weak` (fluent, shallow)  | 55.0, 0/5 in band | 30.8, 5/5 in band | no more lenient — met |
| Cost of a 90-call run       | $0.0295       | $0.0274       |                    |

It passes, and the reading is more mixed than the table. **Equal accuracy hides
different misses.** Each model puts 73 of 90 runs in band, but not the same 73:

| Fixture                  | Band     | `gpt-4o-mini` mean (in band) | `gpt-6-luna` mean (in band) |
| ------------------------ | -------- | ---------------------------- | --------------------------- |
| `beh-strong-conflict` | strong | 87.8 (5/5) | 87.6 (5/5) |
| `beh-weak-conflict` | weak | 26.0 (5/5) | 35.0 (5/5) |
| `beh-mediocre-conflict` | mediocre | 65.6 (5/5) | 56.0 (5/5) |
| `beh-strong-failure` | strong | 69.6 (5/5) | 88.0 (5/5) |
| `beh-weak-failure` | weak | 15.0 (5/5) | 28.8 (5/5) |
| `tech-strong-code` | strong | 86.6 (5/5) | 94.0 (5/5) |
| `tech-weak-code` | weak | 50.4 (0/5) | 44.8 (3/5) |
| `tech-mediocre-code` | mediocre | 63.0 (5/5) | 76.8 (0/5) |
| `design-strong` | strong | 75.8 (5/5) | 68.4 (5/5) |
| `design-weak` | weak | 55.0 (0/5) | 30.8 (5/5) |
| `design-mediocre` | mediocre | 65.0 (5/5) | 43.4 (5/5) |
| `screen-strong` | strong | 70.0 (5/5) | 79.6 (5/5) |
| `screen-weak` | weak | 41.0 (5/5) | 48.0 (0/5) |
| `cs-fundamentals-strong` | strong | 77.4 (5/5) | 79.2 (5/5) |
| `cs-fundamentals-weak` | weak | 51.4 (0/5) | 39.0 (5/5) |
| `hr-strong` | strong | 68.0 (3/5) | 87.2 (5/5) |
| `hr-mediocre` | mediocre | 64.0 (5/5) | 70.4 (5/5) |
| `hr-weak` | weak | 40.0 (5/5) | 52.0 (0/5) |

`gpt-6-luna` fixes the three misses that `gpt-4o-mini` made on weak answers it
was not confused about (`design-weak`, `cs-fundamentals-weak`, and the unstable
`hr-strong`, which swung between 55 and 75) and mostly fixes the fluent wrong
code answer. It also introduces three of its own: `screen-weak` at 48 and
`hr-weak` at 52, weak answers placed just above the band's ceiling of 45, and
`tech-mediocre-code` at 76.8 against a ceiling of 72. **Every one of its 17
missed runs is too high and none is too low**, against 15 high and 2 low for the
old model: the new scorer is the more lenient of the two on the answers it gets
wrong, and a human marker should look at `screen-weak` and `hr-weak` before the
ceiling of 45 is taken as settled. On what the harness is for, telling a strong
answer from a weak one, it is clearly better: wider separation, much steadier
repeats (the old model's worst case was an 8.4-point swing on one fixture), and
a better result on the weakness this document has always named. Five runs of 18
fixtures is still a small sample, and one fixture flipping moves accuracy by
5.6 points, so equal accuracy is a tie and not a result.

Why the new model can keep the repeatability claim: it takes a temperature when
its reasoning is off, and the app calls it that way (`model-params.ts`). Many of
its fixtures repeat to the digit (a standard deviation of 0.0), which is what
the temperature of 0.1 was meant to buy.

### Before / after: anchoring the score scale

*Measured in August 2026 on `gpt-4o-mini`, on the fixture set of that date (with two `case` fixtures since replaced by CS fundamentals), before the language-signals block entered the prompt. Kept as the record of what anchoring changed; the current figures are above.*

The measured change, and the reason the harness exists.

The analyzer prompt asked for `"overallScore": number (0-100)` and said nothing
about what any part of that range meant. Behavioural rounds got calibration by
accident — the STAR block forces `present: false` and `quality: 0` on an answer
with no story, which drags the score down — but no other round type had
anything equivalent. `e50e2e4` added five explicit band descriptions to the
cached scaffold, ~213 tokens in, including the line that does the work: _"a
confident, well-presented answer that is wrong belongs in the lower bands"_.

18 fixtures × 3 runs = 54 analyzer calls per run, `gpt-4o-mini`, $0.018.

| Metric                   | Before (`e50e2e4~1`) | After (`e50e2e4`) | Verdict            |
| ------------------------ | -------------------- | ----------------- | ------------------ |
| **Separation**           | 36.4                 | **41.0**          | ✅ wider           |
| Band accuracy            | 63.0%                | **88.9%**         | ✅ +25.9 pts       |
| Separation vs. baseline  | 2.8×                 | **3.2×**          | ✅                 |
| Mean std dev across runs | 0.67                 | 1.39              | ⚠️ slightly worse  |
| Field completeness       | 100%                 | 100%              | — no schema change |

The std dev column is the honest cost: the model moved from near-identical
repeats to varying by about a point and a half on a 0-100 scale. That is a
trade worth taking — a scorer that is perfectly consistent and wrong is not
useful — but it is a real movement in the wrong direction and is recorded rather
than omitted.

**All six remaining misses are the same two fixtures, and all six are lenient.**
`tech-weak-code` returned [50, 50, 55] and `design-weak` returned [55, 55, 55],
for standard deviations of 2.9 and 0.0. The model is not confused about those
answers; it is confidently placing them 5-10 points above the `weak` band's
ceiling of 45. That is a disagreement about where the boundary sits, and this
harness cannot adjudicate it — see `npm run eval:raters`.

One further caveat the summary does not show: every `mediocre` fixture scored
between **60 and 65**, a 5-point spread inside a band 32 points wide. They all
count as hits, but they are hits from a single default value for "middling"
rather than from discrimination within the band.

### Before / after: moving counting out of the LLM

The analyzer used to ask the model for six countable fields. Those moved to
code, which shrank the request scaffold from ~296 to ~245 tokens and removed six
fields from the response.

The saving is not the interesting part — it is small. The interesting part is
whether a smaller schema changed how the model assigns `overallScore`. A schema
change that quietly degrades scoring is a bad trade at any price, and this is
the only measurement that can tell the difference.

**This experiment was never run, and the change shipped anyway.** Recorded here
because that is the honest state, not because it is defensible: the schema was
changed without measuring whether it degraded scoring, on a harness that existed
specifically to answer that question.

To run it: `git stash` any working changes, check out `9cf6024~1`, run the
harness, then repeat at `9cf6024`.

| Metric                   | Before (`9cf6024~1`) | After (`9cf6024`) | Verdict         |
| ------------------------ | -------------------- | ----------------- | --------------- |
| Band accuracy            | _not run_            | _not run_         | must not drop   |
| Mean std dev across runs | _not run_            | _not run_         | must not rise   |
| Strong/weak separation   | _not run_            | _not run_         | must not narrow |
| Field completeness       | _not run_            | _not run_         | —               |

**If band accuracy drops, revert the change and say so.** A ~17% scaffold
reduction is not worth worse scoring, and reporting a reverted experiment is
worth more marks than not running it.

The measurement is also now partly redundant: the anchoring run above sits
downstream of this change and reports 88.9% band accuracy, so whatever the
schema change cost, the current scorer is not obviously broken by it. That is an
argument for deprioritising this experiment, not for claiming it was done.

### Per-round-type accuracy

Worth breaking out, because the round types are not equally easy.

Measured on 19 October 2026, `gpt-6-luna`, 5 runs per fixture:

| Round type      | Fixtures | Runs | Band accuracy | Mean std dev  |
| --------------- | -------- | ---- | ------------- | ------------- |
| behavioral      | 5        | 25   | 100%          | 1.16 |
| system_design   | 3        | 15   | 100%          | 1.87 |
| cs_fundamentals | 2        | 10   | 100%          | 1.35 |
| hr              | 3        | 15   | 67%           | 0.90 |
| technical_swe   | 3        | 15   | 53%           | 1.80 |
| screening       | 2        | 10   | 50%           | 1.10 |

On `gpt-4o-mini`, the same tree: behavioral 100%, screening 100%, hr 87%,
technical_swe 67%, system_design 67%, cs_fundamentals 50%.

The pattern moved with the model. In August the two technical types were the
only ones that missed, which contradicted the expectation that the softer rounds
would be harder; on `gpt-6-luna` the expectation comes back for HR and
screening, where the misses are weak answers scored 3 to 7 points over the band
ceiling, while the design and CS-fundamentals rounds, the fluent-and-wrong
cases, are now perfect. Each round type has two or three fixtures, so a single
fixture moves a type by 20 to 50 points; treat these rows as pointers to
fixtures worth reading, not as measurements of the round types.

August 2026, `gpt-4o-mini`, 3 runs per fixture (the earlier fixture set):

| Round type    | Fixtures | Band accuracy | Mean std dev |
| ------------- | -------- | ------------- | ------------ |
| behavioral    | 5        | 100%          | 1.30         |
| screening     | 2        | 100%          | 0.00         |
| case          | 2        | 100%          | 2.30         |
| hr            | 3        | 100%          | 2.30         |
| technical_swe | 3        | 67%           | 1.80         |
| system_design | 3        | 67%           | 0.50         |

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
- **This measures the analyzer, not the interview.** Whether the _questions_ are
  good, whether the adaptation helps a candidate improve, and whether the app
  teaches anything are separate questions — that is what
  [`UAT.md`](UAT.md) is for.
- **Nothing here has been validated against live traffic.** See
  [`TOKEN-COST.md`](TOKEN-COST.md) for the same caveat on the cost figures.
- **Every figure is one model, on one tree, on one day.** The analyzer moved
  from `gpt-4o-mini` (retiring 14 January 2027) to `gpt-6-luna` on 19 October
  2026, after a run on each from the same tree (§"Model migration"). The same
  `gpt-4o-mini` scored 81.1% that day and not the 88.9% committed in August,
  because two fixtures and the prompt had changed since, so an old number is a
  claim about an old configuration. The next model change needs the same pair
  of runs; the order and the pass criteria are in
  [`TOKEN-COST.md`](TOKEN-COST.md) §"Retirements and the migration".
