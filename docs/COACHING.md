# The coach

Quick drills and the report's "See a stronger answer" both call one endpoint,
`/api/coach/suggested-answer`. It is the only user-facing LLM call in this project
that produces _advice_ rather than a score, and until this document existed it
was also the only one with no rubric worth the name and no evaluation at all.

`docs/EVALUATION.md` is about the analyzer. This is about the coach. They are
not the same pipeline and the difference matters more than it looks.

> **Status: rubric measured, coaching quality not yet measured.**
> The deterministic half of `npm run eval:coach` has been run and committed —
> rubric coverage went from **20/29 criteria to 29/29**, and prompt
> differentiation from **4 of 6 round types to 6 of 6**. The `--live` half,
> which is the half that measures whether the coaching actually helps, **has not
> been run.** See [What has not been measured](#what-has-not-been-measured).

---

## The thing to understand first

**Drills and the analyzer are separate pipelines.**

The drills page never calls `analyzeResponse`. It produces no 0-100 score, it
involves no persona, and it writes nothing to `turn_analyses`. So the anchoring
work that `docs/EVALUATION.md` is built around — commit `e50e2e4`, the five
explicit score bands, the 88.9% band accuracy — **has no effect on drills
whatsoever.** If any part of the report implies drills are "graded", that is
wrong. Drills give you coaching; the interview gives you a score.

The two only meet in one place, and it is new: `npm run eval:coach` uses the
analyzer as a _scorer of the coach's output_. That is the subject of the second
half of this document, including why it is a weaker form of evidence than it
first appears.

---

## How a coaching response is generated

### The request

|                   |                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Route             | `src/app/api/coach/suggested-answer/route.ts`                                                                                          |
| Prompt            | `src/lib/coach-prompt.ts`                                                                                                              |
| Rubric data       | `src/lib/coach-rubric.ts`                                                                                                              |
| Model             | `gpt-5-mini` at `low` reasoning effort, overridable with `COACH_MODEL` (why: [TOKEN-COST.md](TOKEN-COST.md) §"Which model runs where") |
| Temperature       | **0.5** — applies only if `COACH_MODEL` is set to a GPT-4-family model; GPT-5 rejects the parameter                                    |
| Output cap        | 1000 visible tokens (`max_completion_tokens` gains reasoning headroom on GPT-5-family)                                                 |
| Structured output | `response_format: { type: "json_object" }`                                                                                             |
| Cache key         | `prompt_cache_key: coach:${roundType}:${answerMode}`                                                                                   |
| Rate limit        | 20/min/user (`RATE_LIMITS.coach`)                                                                                                      |
| Input caps        | question 4,000 chars, answer 10,000 chars                                                                                              |

**Temperature 0.5, against the analyzer's 0.1.** Deliberate, and the reasoning
is not "coaching is less important". Scoring has to be reproducible — a
candidate who re-runs the same answer and gets 62 then 78 will not trust
anything the app says. Coaching has no such constraint: two different
well-aimed rewrites of the same answer are both correct, and pinning it near
zero produces prose that reads like a form letter. The cost is that coaching
cannot be regression-tested by equality, which is precisely why the harness
measures it by score uplift instead.

### The prompt

Assembled by `buildCoachSystemPrompt(roundType, answerMode)`. Structure:

1. The role line.
2. **The rubric block** (below).
3. **The answer-mode block** (below), empty for a typed answer.
4. The JSON contract: `{"suggestedAnswer": string, "rewrite": string, "tips": string[]}`.
5. Field-by-field instructions, including the no-fabrication clause.

The user message is only `QUESTION:\n…\n\nCANDIDATE ANSWER:\n…`.

### The answer mode

`answerMode` is one of `text` | `speech` | `code`, validated at the route like
`roundType` is — it adds instructions to the system prompt, so an arbitrary
value from a client would be a prompt-injection surface. It defaults to `text`,
which emits no extra block at all, so an omitted field coaches exactly as it
did before the field existed.

| Mode     | Sent by                              | What it changes                                                                                                                                                                                                                                                                       |
| -------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`   | typed drills; text sessions          | nothing                                                                                                                                                                                                                                                                               |
| `speech` | spoken drills; voice sessions        | Tells the model it is reading a live speech-to-text transcript: missing punctuation and capitalisation are artefacts of transcription, to be fixed silently in the rewrite and never spent a tip on. Caps verbal fillers at one tip, since the candidate is separately shown a count. |
| `code`   | the drills editor; any fenced answer | The rewrite must stay code, in the same language and fence — their solution improved, not a description of it. Tips are about correctness, complexity and edge cases.                                                                                                                 |

Both non-default modes exist for one reason: to stop the coach spending its
four tips on the _medium_ instead of the answer. Before this, a spoken answer
reliably produced tips about punctuation nobody had spoken, and a code answer
produced a rewrite that was prose _about_ the function rather than a better
function.

The mode is in the cache key because it is in the prompt. Without it the three
variants would share a key and each would keep invalidating the others' cached
prefix.

### The rubric

This is the part that was missing. Until this change, `rubricGuidance` had
**two branches for six round types**:

```ts
if (isTechnicalRound(roundType) && roundType) {
  return `This is a ${ROUND_RUBRIC_LABELS[roundType]} question. A strong answer is
          structured: clarify the problem, state assumptions, reason through
          tradeoffs out loud, and land on a concrete approach with complexity/impact.`;
}
return "This is a behavioral question. A strong answer uses the STAR structure …";
```

So a screening answer about motivation and an HR answer about notice periods
were both coached as behavioural STAR stories — while the analyzer, in the
interview, scored those same round types against _"Clarity, motivation, fit,
concision"_ and _"Motivation, values fit, logistics, questions for us"_. The
coach was aiming at a target the scorer was not using.

`COACH_RUBRICS` is now a `Record<InterviewRoundType, CoachRubric>` — the same
compile-error-on-incomplete guarantee `round-types.ts` argues for — with four
fields per round type:

| Field          | What it carries                                  |
| -------------- | ------------------------------------------------ |
| `shape`        | The structural template a strong answer follows  |
| `signals`      | What a strong answer demonstrates                |
| `failureModes` | How answers of this type characteristically fail |
| `exemplar`     | What the invented `suggestedAnswer` must show    |

**The criteria themselves are never re-typed.** The prompt interpolates
`ROUND_RUBRIC_LABELS[roundType]`, so the coach is told the exact string the
analyzer scores against. If someone replaces that interpolation with hand-typed
prose, `coach-prompt.test.ts` fails — that test is a drift guard, not a quality
measure, and it says so.

Why its own module rather than a field on `RoundTypeSpec`: `round-types.ts` is
imported by client components for `icon`, `accent` and `label`, so hanging
coaching prose off `RoundTypeSpec` would ship all six rubrics to the browser on
every page that renders a round-type chip, to be used by one server route.

### The no-fabrication clause

The old clause read _"Do not fabricate major new achievements"_. That cannot be
tested, because "major" is undefined. It now reads:

> Every specific in `rewrite` — every number, name, date and outcome — must
> already appear in the candidate's answer. If their answer contains no number,
> the rewrite contains no number: say what they should have measured instead of
> inventing a measurement.

That is a set comparison over quantities, which the harness performs. Rewriting
a contract so it can be checked is most of what made the contract worth having.

### Parsing and failure handling

`parseCoachResult` mirrors the analyzer's defensive path:

- Strips ``` fences, falls back to `jsonrepair` on a parse failure, and reports
  `repaired: true` when it had to — nothing counted this before.
- Reports **`omittedFields`**, recorded _before_ the `""` defaults fill them in.
  The direct analogue of `AnalysisResult.omittedFields`, and it exists for the
  same reason: without it the finished object is complete by construction and a
  completeness metric measures nothing.
- Reports `contractWarnings` for breaches that are not omissions — a tip count
  outside 2-4, tips past ~12 words.
- `finish_reason === "length"` is detected and returned rather than thrown, so
  the route can map it to a 502 that names truncation while the harness can
  _count_ truncations. A truncated response is almost-valid JSON, so without
  this check it failed as a generic parse error that named the wrong cause.
  (The 700 → 1000 token sizing is in `docs/TOKEN-COST.md`.)
- If both `suggestedAnswer` and `rewrite` come back empty, the route now returns
  **502** rather than 200. It used to render an empty coaching panel, which
  reads as the feature being broken with no error to report.

### Caching, and why drills never hits it

`cacheable` requires **both** `sessionId` and `turnIndex`
(`route.ts`). The report page sends both, so reopening a report serves coaching
from `coach_answers` (migration `0010`) instead of paying again. **The drills
page deliberately sends neither** — a drill has no session and no turn — so
**every drill submission is a full billed call**, bounded only by the 20/min
rate limit. This is a deliberate trade, not an oversight, but it means drills
are the most expensive per-interaction feature in the app.

### Trust boundary

`roundType` arrives from the client and selects the rubric, so a garbage value
would silently change how the answer is coached. It is validated with
`isRoundType` before it reaches the prompt, and
`route.test.ts` asserts that a path-traversal string never lands in the system
prompt. Unknown or absent types fall back to `COACH_FALLBACK_ROUND_TYPE`
(`behavioral`) — named, because two tests assert it.

---

## Evaluating it: `npm run eval:coach`

```bash
npm run eval:coach                    # deterministic only, free, offline
npm run eval:coach -- --live          # + coach and analyzer calls, costs money
npm run eval:coach -- --live --runs=3
npm run eval:coach -- --live --only=hr
npm run eval:coach -- --live --json
npm run eval:coach -- --live --recovery
```

Two layers, split the way `run-persona-eval.ts` splits its own — one that cannot
fail on stage, one that costs money and is stochastic.

### Layer 1 — deterministic

Free, offline, byte-identical on every run. The "before" arm is the old
two-branch prompt, reproduced verbatim inside the harness as a control, so the
comparison is one command rather than a `git checkout` — the same choice
`run-eval.ts` makes by embedding the keyword heuristic.

Measured at `HEAD`, committed to
[`docs/artifacts/coach-eval-deterministic.txt`](artifacts/coach-eval-deterministic.txt):

| Metric                       | Before      | After                              |
| ---------------------------- | ----------- | ---------------------------------- |
| Distinct system prompts      | 4 of 6      | **6 of 6**                         |
| Rubric criteria named, total | 20 / 29     | **29 / 29**                        |
| — `screening`                | **0 / 4**   | 4 / 4                              |
| — `hr`                       | **0 / 4**   | 4 / 4                              |
| — `behavioral`               | 2 / 3       | 3 / 3                              |
| — `technical_swe`            | 7 / 7       | 7 / 7                              |
| — `system_design`            | 6 / 6       | 6 / 6                              |
| — `case`                     | 5 / 5       | 5 / 5                              |
| Est. system prompt           | ~150 tokens | ~517 tokens, cached per round type |

Two things worth reading carefully rather than skimming.

**"4 of 6", not 2 of 6.** The prediction written into the plan for this work was
2 of 6 — reasoning that screening, behavioral and hr shared one branch and the
three technical types shared the other. Half right: the technical branch
interpolates `ROUND_RUBRIC_LABELS[roundType]`, so those three _were_ already
distinct from each other. Only the three behavioural-family types collapsed
into one. The harness measured it; the guess was wrong, and the measured number
is the one in the table.

**`screening` and `hr` scored zero.** Not "low" — the old prompt named _none_ of
clarity, motivation, fit, concision, values fit, or logistics, while the
analyzer scored those rounds on exactly those criteria. That is the single
clearest statement of what this change fixed.

### Layer 2 — live

Per fixture per run: one coach call, three analyzer calls (original / rewrite /
suggested answer). Coach at the deployed temperature 0.5, following
`run-persona-eval.ts`'s reasoning that it should measure deployed behaviour
rather than a quieter version of it; stability comes from `--runs`. All judges
run at temperature 0, because they are measurement.

**The headline metric is uplift:**

> uplift = analyzer(`rewrite`) − analyzer(original), paired per fixture

A coach that does not raise the score is not coaching, and this number can come
back at zero or negative. That is what makes it worth reporting.

**The null model is the identity coach.** A coach whose rewrite is the
candidate's answer unchanged has an uplift of exactly zero by construction — so
scoring the original N times _is_ the control arm, and the standard deviation of
those scores is the analyzer's test-retest noise floor. Uplift only counts if it
clears that floor. The second control is `scoreAnswerHeuristically().tips`, a
regex that also emits tips, which is the null model for the tips claim.

What it reports, and what each row can do to the conclusion:

| Metric                               | Question                                           | How it can come back bad |
| ------------------------------------ | -------------------------------------------------- | ------------------------ |
| Uplift + 95% CI                      | Does the rewrite beat the original?                | CI spans 0               |
| Noise floor                          | Is uplift bigger than scoring the same text twice? | uplift ÷ sd < 2          |
| Exact sign test, Cohen's d_z         | Is it beyond what 18 pairs produce by chance?      | p > 0.05                 |
| **Uplift by band**                   | Real coaching, or just weak answers having room?   | flat curve               |
| **Word delta, corr(uplift, length)** | Is uplift just more words?                         | high r                   |
| Model-answer band                    | Is the exemplar exemplary?                         | not `strong`             |
| Fact retention / novel quantities    | Does the rewrite keep their facts?                 | low retention            |
| Fabrication judge (blind)            | Does it invent achievements?                       | non-zero rate            |
| Tip–gap coverage vs heuristic        | Do tips beat a regex?                              | ties the control         |
| Rubric recovery (`--recovery`)       | Does coaching differ by round type?                | ~1/6, chance             |
| Contract conformance                 | Completeness, tip counts, repairs, truncation      | any                      |

The sign test is **exact**, not normal-approximated, because n is 18 — the
approximation would be quoted to three decimal places it has not earned. The
bootstrap CI is **seeded**, so a committed artifact reproduces; an unseeded
interval is a number a reader cannot check.

Blinding, in three places: the fabrication judge is never told what result is
hoped for; the tip–gap matcher receives the coach's tips and the heuristic's
tips unlabelled, with which is which varying per fixture, so it cannot learn a
position convention; the rubric-recovery judge sees only the coaching, never the
question or the round type.

### Fixtures

The primary corpus is the existing `FIXTURES` — 18 hand-written answers across
all six round types with known bands. Reused rather than replaced because
uplift needs the original's quality to be _known_, the bands supply the headroom
prediction that makes the metric falsifiable (weak should gain more than strong,
which starts in the eighties), and the analyzer's behaviour on that exact text
has already been measured.

`src/eval/coach-fixtures.ts` adds four, for one property the main set is
structurally unable to measure: several of its weak fixtures contain **no
numerals at all**, so fact retention is 0 of 0 and undefined, and a coach that
invents quantities is indistinguishable from one that does not. Each carries a
hand-listed `checkableFacts`, so the retention metric has ground truth rather
than a regex checking itself.

`weak-dense` is the one that matters: a bad answer full of real numbers — a
candidate who has the evidence and buries it. A good coach surfaces their
figures; a fabricating one adds figures that were never there. Every other
fixture can be passed by a coach that simply copies numbers across.

### Cost

Roughly 228 calls at `--live --runs=2`, about **$0.06 a run** at `gpt-4o-mini`
rates — around 3× `npm run eval`, because the coach arm needs three analyzer
calls for every coach call. The deterministic layer is free and is the default.

The `UsageCollector` is **deliberately never flushed**: these are synthetic
fixtures, and writing them to `llm_usage` would contaminate the per-session
figures `run-cost-report.ts` reads. Same choice `run-eval.ts` makes.

---

## Why this judge is not independent

State it here rather than let a marker find it.

**1. Shared rubric.** The coach is now instructed against
`ROUND_TYPE_SPECS[t].rubric` and the analyzer scores against
`ROUND_RUBRIC_LABELS[t]` — literally the same string. Uplift therefore measures
_instruction-following against a shared rubric_, not pedagogical value to a
human being. Same model family, same author, same prompt idiom.

**2. Shared blind spot, and it is a documented one.**
`docs/EVALUATION.md` records that this analyzer is lenient toward fluent,
confident, wrong answers: `tech-weak-code` returned [50, 50, 55] and
`design-weak` [55, 55, 55] against a `weak` ceiling of 45, with standard
deviations of 2.9 and 0.0. A coach that makes an answer more fluent moves
exactly the dimension the analyzer over-weights.

That is why the word-count and correlation rows sit in the headline block rather
than an appendix. **Read uplift next to them, never alone.**

The honest framing: the analyzer is an independent scorer of the coach in the
sense that it was written, tuned and validated before the coach was evaluated,
against a different set of claims. It is _not_ an independent judge of coaching
quality, because it shares the coach's rubric and the coach's blind spots. Uplift
measures whether the coach moves an answer in the direction the app's own rubric
points. Whether that direction is the right one is a question for people.

---

## What has not been measured

- **The `--live` layer has not been run.** Everything in the Layer 2 section
  describes what the harness computes, not results it has produced. No uplift
  figure, no fabrication rate, no tip coverage number exists yet. Running it
  costs about $0.06 and needs `OPENAI_API_KEY`; the output belongs in
  `docs/artifacts/coach-eval.txt` alongside the deterministic run, and **if
  uplift comes back at zero that number gets committed too.** A reported null
  result is worth more than an unrun experiment — which is a mistake this
  project has already made once and recorded, in `docs/EVALUATION.md`.
- **No human has read a single rewrite as evidence.** The blind pairwise A/B
  described in the plan for this work (`--sheet` / `--score`, mirroring
  `run-rater-sheet.ts`) is **not implemented**. It is the only non-circular
  evidence available, and until it exists "the coach improves answers" means
  "the analyzer scores the coach's rewrite higher than the candidate's".
- **n = 22 fixtures, one author.** The answers, the bands, the coach rubric and
  the analyzer rubric all come from the same person, so this measures internal
  consistency more than external validity — the same concession
  `docs/EVALUATION.md` makes, compounded here because the coach is graded by a
  scorer that person also wrote.
- **Uplift has a ceiling, so the aggregate depends on the corpus mix.** Strong
  fixtures start in the eighties and cannot gain thirty points. The per-band
  table is the real result; the headline number must never be compared across
  different fixture sets.
- **Fabrication is measured by proxy.** A novel numeral is not a fabricated
  achievement, and a fabricated achievement need not contain a numeral.
- **Round-type differentiation rests on one answer and six calls.** The
  deterministic prompt diff is exact; the empirical recovery figure is an
  illustration, not a sample.
- **Nothing here measures whether a candidate who reads the coaching does
  better next time.** That is what `docs/UAT.md` is for, and no offline harness
  can answer it.
