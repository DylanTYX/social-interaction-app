# Do the persona dials change the interview?

The setup wizard draws six sliders from 1 to 10. That is a promise: that moving
one changes how the interviewer questions you, and that the number means
something. This document is how that promise gets checked rather than asserted.

> **Status: the dials are wired, and four of six now demonstrably reach the
> model.**
> Five of the six produce 10 distinct behaviours across their 10 settings, and
> probing depth produces 9 — offline, byte-identical, pinned by tests. Live, at
> 51 generations per cell: pushback, probing depth and unpredictability all move
> their pre-registered axis with the interval well clear of zero, and pace
> correctly moves nothing. Strictness is borderline and warmth did not show.
> **Nothing here shows that 8 differs from 9 in the output**, because the
> experiment tests 2, 5 and 9 only.

Everything below was produced by `npm run eval:persona`. The deterministic layer
needs no API key and is byte-identical on every run; the live layer costs about
three cents and is committed as an artifact.

---

## 1. The claim, split in two

> **Moving a dial changes how the interviewer questions you. The sliders are not
> decoration.**

It splits, because the halves need different evidence and fail differently.

| Claim | Evidence | Fails if |
| --- | --- | --- |
| **C1. The number is consumed** — a different value produces a different instruction and a different engine decision | §3, offline and repeatable | A dial shows one outcome across all ten steps |
| **C2. It reaches the interview** — a different value produces a different question | §4, live, blind-judged, against a no-persona control | High and low are indistinguishable to a blind judge |

C1 alone would not settle it: an engine value that never changes a sentence is
still decoration. C2 alone would not either: one sample of generations could be
the model's own variance. Together they trace the number from the slider to the
sentence a candidate reads.

**What this does not prove.** That the resulting behaviour resembles a human
interviewer, or that any setting is the right default. Both need human raters.
The sheet exists (`npm run eval:raters`) and has not been pointed at this.

---

## 2. Why two presets were not enough

The harness began by comparing two preset personas, Aisyah Rahman against
Isabella Rodriguez. They differ on **every** dial and on questioning style, so a
difference between them cannot be attributed to any one of them. It answers
"do two interviewers differ?", which was never the question.

Every experiment here moves **one dial at a time** with the other five held at
the neutral 5.

---

## 3. What each dial changes, one dial at a time

`npm run eval:persona` sweeps each dial 1→10 and records every real consumer,
called through its actual entry point — `generatePersonaPrompt`,
`decideInterviewAction`, `estimateFollowupDifficulty`, `paceToRatePercent` — so a
threshold that moves shows up here instead of being restated.

| Dial | Distinct behaviours in 10 steps | Identical settings | What it drives |
| --- | --- | --- | --- |
| `strictness` | **10** | none | acceptance bar 45→90/100, specifics floor 1→5, re-ask allowance 1→4, difficulty target |
| `warmth` | **10** | none | acknowledgement allowance 0→11 words, slow-down gate, difficulty target |
| `pace` | **10** | none | question word budget 57→30, TTS rate −20%→+25% |
| `pushback` | **10** | none | challenge rung 0→4, unsupported claims allowed 5→0, twist/pivot weighting |
| `probingDepth` | **9** | 6 and 7 | probe tier 1→7, follow-ups before moving 1→5 |
| `unpredictability` | **10** | none | curveball rate 0%→70% |

Probing depth 6 and 7 both select probe tier 5 — `ceil(d / 10 × 7)` — so they are
genuinely the same interviewer. It would have been easy to invent a threshold to
reach ten; that would be a number without a meaning.

### Where these numbers started

Before this work, four of the six dials resolved four or five of their ten steps,
because the interviewer's instructions were written as three or four bands of
adjective. Strictness 8, 9 and 10 were one interviewer. Worse, pushback's two
**extremes** were each a single setting — 1 and 2 identical, 9 and 10 identical —
because all of its consumers happened to break in the middle of the scale.

| Dial | Before | After |
| --- | --- | --- |
| strictness | 5 | 10 |
| warmth | 5 | 10 |
| pace | 4 | 10 |
| pushback | 5 | 10 |
| probingDepth | 7 | 9 |
| unpredictability | 10 | 10 |

What closed the gap was giving each dial a directive **a reader can count**
alongside the adjective it already had: a bar on the analyzer's own 0–100 scale,
an allowance in words, a number of claims to contest, a number of unsupported
claims to let pass. Two coarse scales that break at different points resolve more
finely than either alone, which is how warmth and pushback reached ten without
pretending a single question can carry ten degrees of anything.

**One number here is deliberately not counted.** The prompt states each dial's
own value ("strictness 9/10"), so the raw prompt text differs at all ten steps by
construction. Counting that would report ten out of ten for every dial and mean
nothing. It is reported as an `instruction` column and excluded from the
headline, and a test asserts it stays excluded.

### The interviewer is not a one-note questioner

Across eight answer qualities × six styles × dial settings — 5,184 decisions —
**eight of the nine strategies are used**:

```
DRILL_SPECIFICITY    25.0%     CHALLENGE_OWNERSHIP  25.0%
CLARIFY_SITUATION    12.5%     EXPLORE_RESULT       12.5%
PROBE_ACTION          7.6%     ACKNOWLEDGE_STRENGTH  7.6%
HYPOTHETICAL_TWIST    6.7%     PIVOT_TOPIC           3.0%
```

The ninth, `ASSESS_THINKING`, is technical-round only and a behavioural ladder
never reaches it.

**The honest half of that finding:** *within* one answer quality the move is
almost fully determined. A vague answer returns `DRILL_SPECIFICITY` under all 216
combinations of style, depth and unpredictability, because a weakness-driven move
always outranks a curveball — deliberately, and the way a real interviewer
behaves. So variety across an interview comes from the candidate's answers
changing, not from the dials. The dials change *how hard* the interviewer presses
within the move it has already chosen.

---

## 4. Does it reach the model?

14 arms × 12 generated follow-ups: a no-persona control, a neutral persona with
every dial at 5, and each dial at 2 and at 9. Every follow-up answers the
identical question and answer, and is rated by a judge that is never told the
persona, the dial or the level, at temperature 0, on four axes at once — so a
dial that moves an axis it was not designed to move is visible rather than
quietly dropped.

**Expectations were written in code before the run** (`EXPECTATIONS` in
`src/eval/persona-experiment.ts`) and are printed beside each result whether or
not they held.

| Dial | Predicted | Measured, 2 → 9 | Verdict |
| --- | --- | --- | --- |
| unpredictability | topic shift ↑ | **+2.4** [1.6, 3.1], monotonic | **held** |
| probingDepth | adaptivity ↑ | **+1.5** [1.0, 2.1] | **held** |
| pushback | demandingness ↑ | **+1.1** [0.7, 1.5] | **held** |
| pace | no effect | none on any axis | **held** |
| strictness | demandingness ↑ | +0.6 [0.0, 1.1], monotonic | borderline |
| warmth | supportiveness ↑ | +0.1 [−0.1, 0.3], monotonic | not shown |

Four of six, and the three largest effects in the whole experiment belong to the
three dials that had previously shown nothing at all.

### What changed, and why it is the most important result here

Every earlier run was measuring a system whose steering note was never read. The
note sat ahead of the transcript, lost to recency, and the three dials that act
through the decision engine rather than through persona prose — pushback,
probing depth, unpredictability — were effectively disconnected from the output.

The clearest single number in this document:

| | Steering note before the exchange | After |
| --- | --- | --- |
| Pivots that opened the named subject | **0 of ~150** | **45 of 45** |
| unpredictability → topic shift | −0.2 (wrong sign) | **+2.4** |
| probingDepth → adaptivity | 0.0 | **+1.5** |
| pushback → demandingness | +0.1 | **+1.1** |

Nothing about the dials changed between those columns. One message moved.

**Strictness and warmth moved the other way**, from held to borderline and not
shown. Both act mainly through persona prose, which was always being read, so
their effects were never suppressed — and at +0.3 in the earlier run they were
small enough that the interval's position either side of zero is exactly the
instability §"The replication" warns about. The honest reading is that these two
are weak effects this experiment cannot pin down, not that they stopped working.

### What the text shows that the judge does not

Counted directly from the follow-ups, needing no judge:

| Cell | Words | Questions | Reuses the answer's wording |
| --- | --- | --- | --- |
| probingDepth 2 | 29 | 1.1 | 11/12 |
| **probingDepth 9** | **21** | **1.5** | **3/12** |
| pushback 2 | 27 | 1.0 | 11/12 |
| **pushback 9** | **32** | **1.7** | 7/12 |

Probing depth changes the question substantially — a third shorter, 40% more
questions — while the judge reports no change in adaptivity. **The judge is the
weaker instrument here, not the product.** Its topic-shift score has zero
variance across most cells: it returns 2.0 whatever it reads.

The last column is worth distrusting too. It counts shared distinctive words, and
at depth 9 the engine fires `PROBE_ACTION`, producing a short question aimed at
one hedged phrase — more targeted, less verbally overlapping. It measures
vocabulary reuse, not engagement, and should not be read as the latter.

---

## 5. Faults found by running the harness

None would have been caught by reading the code.

**The steering note was never read.** This is the one that mattered. The private
note carries the strategy, the focus and the difficulty target — the whole
adaptive loop — and it sat in the system prompt, ahead of the transcript and
ahead of the answer it responds to. On a topic pivot it says "change direction"
and names the subject to open; the model opened that subject **0 times in 10**
and asked about the story it had been told to leave, in nearly the same words
every time. With the identical text moved after the exchange: **10 times in 10**.

The instruction was never weak. Above it sat ~656 tokens of persona telling the
interviewer to press for specifics, contest claims and stay on the answer; below
it sat the story itself. One line asking it to let go could not win that.

Two things about how this was found are worth more than the fix. **The blind
judge missed it completely** — it rated those follow-ups as perfectly reasonable
questions, because they *are* reasonable questions; they were simply not the ones
the system asked for. Only the deterministic check — did the text name the
subject the engine chose? — caught it, which is the argument for counting over
rating in one example. And **it is invisible to review**: the block was
well-written, correctly built, covered by tests and sent on every single turn.
Position in a request is part of an instruction's meaning, and nothing but
generated output will tell you so.

Recorded as [DESIGN-DECISIONS.md](DESIGN-DECISIONS.md) §17.

**The live arm had never run.** It requests `response_format: json_object`, which
OpenAI rejects with a 400 unless some message contains the literal word "json".
No message did, so every judge call failed. `INTERVIEWER.md` §7 recorded the arm
as "not run yet" without recording that it *could not* run.

**The steering block cancelled its own pivots.** On a topic pivot it told the
model to change direction, then supplied a focus and a gap drawn from the subject
it had just said to leave. Given three concrete instructions and one abstract
one, the model followed the concrete ones. Measured: unpredictability moved topic
shift by 0.0 while pushback — whose move is a twist *within* the topic, so it
contradicts nothing — moved it by 2.2.

**And then a third, which this document caused.** Giving probing depth a prompt
voice introduced "stay on the same answer for at least N follow-ups", a standing
order that fought the pivot instruction the same way. Pushback's topic-shift
effect fell from +2.2 to +0.6 until the persona line was made to defer to the
private notes. Each directive added is another thing that can contradict
something else: **resolution and reliability trade against each other**, and ten
instructions half-followed may be worth less than four followed exactly.

---

## 6. Limitations

- **Adjacent steps are untested.** 2, 5 and 9 only. Treat the dials as three
  reliable behavioural bands over a continuous instruction, and do not claim 8
  differs from 9 in the output.
- **The judge saturates.** Scores cluster at 7–9 with a topic-shift axis of zero
  variance. Blind pairwise comparison, or counting, would be more sensitive.
- **One question, one round type, one answer.** A behavioural question answered
  well. Nothing here covers technical rounds or a poor answer.
- **n = 12 per cell, and it shows.** Two runs at the same commit disagreed on
  four of the six dials. Any single run of this experiment, including the
  committed one, should be read as indicative. A stable estimate needs several
  times the sample.
- **The answer is deliberately a good one.** Against a vague answer the engine
  returns `DRILL_SPECIFICITY` for every persona and four dials switch off — by
  design. Measuring a dial requires an answer that has cleared the fundamentals,
  which is itself a finding about when the dials apply.
- **One model, `gpt-4o-mini`**, as interviewer and judge. A judge sharing the
  generator's family may share its blind spots.
- **No human raters.** Nothing establishes that any of this resembles a real
  interviewer.

---

## 7. Reproducing it

```bash
npm run eval:persona                      # offline, free, byte-identical
npm run eval:persona -- --live --runs=12  # ~$0.03, needs OPENAI_API_KEY
npm run eval:persona -- --json            # machine-readable
```

Artifacts: [`artifacts/persona-eval.txt`](artifacts/persona-eval.txt) and
[`artifacts/persona-eval-live.txt`](artifacts/persona-eval-live.txt). Each is
stamped with the commit it came from and refuses to be quoted if generated from a
tree with uncommitted changes.

The headline numbers are asserted in `src/eval/persona-sweeps.test.ts` and run in
CI, so a threshold that moves breaks the build and names this document. That, not
a dashboard, is what keeps these figures from going stale.

---

## 8. Sources

Unchanged by this work; they justify the dial set, which is not what was measured
here. Compiled without internet access — check each against the original before
quoting (see [CHANGELOG.md](CHANGELOG.md)).

- arXiv 2608.10412 — default LLM interviewers issue deepening probes on 4.9% of
  turns. The baseline for probing depth.
- Amazon — Bar Raiser, and the "Dive Deep" leadership principle.
- HackerRank — interviewer archetypes, including the supportive one.
- SHRM — structured interviewing guidance.
