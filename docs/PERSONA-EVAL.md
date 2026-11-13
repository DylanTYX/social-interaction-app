# Do the persona dials change the interview?

The setup wizard draws six sliders from 1 to 10. That is a promise: that moving
one changes how the interviewer questions you, and that the number means
something. This document is how that promise gets checked rather than asserted.

> **Status: the dials are wired, and all six reach the model.**
> Five of the six produce 10 distinct behaviours across their 10 settings, and
> probing depth produces 9 — offline, byte-identical, pinned by tests. Live, on
> the interviewer the app ships (`gpt-5.6-luna`) at 51 generations per cell, all
> six pre-registered expectations held. Unpredictability and probing depth move
> their axes by 4.3 and 2.0 points; strictness (1.4), pushback (0.8) and warmth
> (0.5) move theirs by less but clear of zero; pace, which should do nothing,
> moved nothing an interval can tell from zero. **Nothing here shows that 8
> differs from 9 in the output**, because the experiment tests 2, 5 and 9 only.
>
> **The live figures predate the changes of 21 October 2026**, which put warmth
> and pushback into the private note, separated warmth from praise and spread the
> presets out ([DESIGN-DECISIONS.md](DESIGN-DECISIONS.md) §19). They describe the
> previous prompt until `npm run eval:persona -- --live` is run again. The
> offline layer below is current.

Everything below was produced by `npm run eval:persona`. The deterministic layer
needs no API key and is byte-identical on every run; the live layer costs about
17 cents at 51 generations per cell and is committed as an artifact.

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

14 arms × 51 generated follow-ups: a no-persona control, a neutral persona with
every dial at 5, and each dial at 2 and at 9. Every follow-up answers the
identical question and answer, and is rated by a judge that is never told the
persona, the dial or the level, at temperature 0, on four axes at once — so a
dial that moves an axis it was not designed to move is visible rather than
quietly dropped. The interviewer is `gpt-5.6-luna`, the model the app ships; the
judge is `gpt-6-luna`, a different generation, so it is never rating its own
family's writing.

**Expectations were written in code before the run** (`EXPECTATIONS` in
`src/eval/persona-experiment.ts`) and are printed beside each result whether or
not they held.

| Dial | Predicted | Measured, 2 → 9 | Verdict |
| --- | --- | --- | --- |
| unpredictability | topic shift ↑ | **+4.3** [3.1, 5.5], monotonic | **held** |
| probingDepth | adaptivity ↑ | **+2.0** [1.0, 3.0], monotonic | **held** |
| strictness | demandingness ↑ | **+1.4** [1.0, 1.8], monotonic | **held** |
| pushback | demandingness ↑ | **+0.8** [0.4, 1.2], monotonic | **held** |
| warmth | supportiveness ↑ | **+0.5** [0.3, 0.7], monotonic | **held** |
| pace | no effect | largest is demandingness, +0.4 [−0.1, 0.9] | **held** |

Six of six. Two readings keep that from being more than it is.

**"Held" means the predicted axis moved the right way, not that it was the only
one to move.** The dials leak into each other, and the leaks are the most useful
thing in the output. Pushback's largest effect is on adaptivity (+2.3) and topic
shift (−1.5), not on the demandingness it was predicted to raise (+0.8). Warmth
lowers demandingness (−0.9) as well as raising supportiveness. Unpredictability
lowers adaptivity by 4.2, which is what a model that keeps changing the subject
should do: it cannot also be following the answer. A dial is a bundle of
effects, and the sliders should not be described as moving one thing.

**The small effects are small.** Warmth moves judged supportiveness by half a
point on a ten-point scale. That is a real, repeatable difference and not one a
candidate would name.

### What an earlier measurement got wrong

The committed run of 18 September found four of six on `gpt-4o-mini`: strictness
borderline (+0.6, interval from 0.0 to 1.1) and warmth not shown (+0.1). The
shipped model shows both. That is not evidence the new model obeys better,
because the judge changed in the same move, and the old one was plausibly part
of the problem. `gpt-4o-mini` judging `gpt-4o-mini` rated a persona-free control
7.9 out of 10 for supportiveness and all three warmth settings between 6.2 and
6.3, a compressed scale with little room to show a dial. `gpt-6-luna` rates the
same control 3.9 and spreads the settings further apart. Only §5, where the
judge is held fixed, compares interviewers cleanly.

### What changed, and why it is the most important result here

Every run before the middle of September was measuring a system whose steering
note was never read. The note sat ahead of the transcript, lost to recency, and
the three dials that act through the decision engine rather than through persona
prose — pushback, probing depth, unpredictability — were effectively
disconnected from the output.

The clearest single number in this document (both columns measured on
`gpt-4o-mini`, the interviewer at the time):

| | Steering note before the exchange | After |
| --- | --- | --- |
| Pivots that opened the named subject | **0 of ~150** | **153 of 153** |
| unpredictability → topic shift | −0.2 (wrong sign) | **+2.4** |
| probingDepth → adaptivity | 0.0 | **+1.5** |
| pushback → demandingness | +0.1 | **+1.1** |

Nothing about the dials changed between those columns. One message moved.

### What the text shows that the judge does not

Counted directly from the follow-ups, needing no judge:

| Cell | Words | Questions | Reuses the answer's wording |
| --- | --- | --- | --- |
| probingDepth 2 | 24 | 0.9 | 23/51 |
| **probingDepth 9** | **28** | **1.0** | **51/51** |
| pushback 2 | 25 | 1.0 | 17/51 |
| **pushback 9** | **26** | **1.0** | 18/51 |

The two dials show different things. Probing depth is visible in the text and
the judge agrees: at depth 9 every one of the 51 follow-ups picks up the
candidate's own words, because the engine fires `PROBE_ACTION` and the note
names the hedged phrase to quote back. Pushback is the opposite case. The judge
sees a large change in how the interviewer questions (adaptivity +2.3), while
length, question count and wording reuse barely move, because a challenge is
different in kind rather than in surface. Counting would have missed it, which
is the argument for using both instruments and for not trusting either alone.

The last column measures vocabulary reuse, not engagement. It counts shared
distinctive words and should not be read as the latter.

---

## 5. Model migration, October 2026

`gpt-5-mini` retires on 11 December 2026 and `gpt-4o-mini` on 14 January 2027
([TOKEN-COST.md](TOKEN-COST.md) §"Retirements and the migration"). The
interviewer is the part of the app whose words the candidate reads and hears, so
this is the experiment that decided its replacement. It ran on the retiring and
the candidate interviewer with the experiment above unchanged and the judge held
fixed at `gpt-6-luna`.

| | `gpt-5-mini` (retiring) | `gpt-5.6-luna`, first run | `gpt-5.6-luna`, shipped |
| --- | --- | --- | --- |
| strictness → demandingness | +1.0 [0.7, 1.3] | +1.2 [0.8, 1.6] | +1.4 [1.0, 1.8] |
| warmth → supportiveness | +0.6 [0.2, 0.9] | +0.8 [0.6, 1.0] | +0.5 [0.3, 0.7] |
| pace → demandingness (none expected) | −0.2 [−0.4, 0.1] | +0.6 [0.0, 1.1] | +0.4 [−0.1, 0.9] |
| pushback → demandingness | +0.3 [0.1, 0.5] | +0.7 [0.4, 1.1] | +0.8 [0.4, 1.2] |
| probingDepth → adaptivity | +2.6 [1.6, 3.7] | +1.9 [1.0, 2.9] | +2.0 [1.0, 3.0] |
| unpredictability → topic shift | +4.4 [3.1, 5.6] | +4.2 [2.9, 5.3] | +4.3 [3.1, 5.5] |
| **Expectations held** | **6 of 6** | **5 of 6** | **6 of 6** |
| Topic pivots that opened the named subject | 153 of 153 | 153 of 153 | 153 of 153 |
| Probe follow-ups that quote or attribute the candidate's words | 50 of 51 | **0 of 51** | **51 of 51** |
| Mean follow-up length | 36.9 words | 23.9 words | 24.0 words |
| Cost of the run | $0.249 | $0.174 | $0.174 |

The decision is `gpt-5.6-luna`. It matches the retiring model on every
expectation and every pivot, writes follow-ups a third shorter, which suits a
spoken question, and costs 30% less to evaluate. Time to the first word, which
is what a voice candidate waits for, was a median 892 ms against 903 ms.

### The first run found a fault in the app, not the model

The first run on `gpt-5.6-luna` is the second column, and it was not clean. The
pace interval only just excluded zero, which cost the sixth expectation, but the
more important signal was in the quoting row. Of the 51 probe follow-ups at
depth 9, none quoted the candidate. They read like this:

> What specifically changed in your process after that launch, and how did you
> handle stakeholders who pushed back on cutting features?

The probing-depth effect was still there (+1.9), because the question was
specific and the judge rated it adaptive. But the product promise for this dial
is that the interviewer picks up your own words, and that was gone.

The cause was in the app. The engine chooses a probe from seven signals and
writes a private note for each. Only one of the seven sentences told the
interviewer to quote the phrase back; the other six said only to ask about it.
`gpt-5-mini` quoted anyway (50 of 51). `gpt-4o-mini` mostly did not (3 of 51),
and nothing had flagged it. A model that follows an instruction exactly, and
nothing beyond it, exposed an instruction that had never been complete. All six
sentences now say to quote it back (`SIGNAL_PROBES` in
`src/lib/decision-engine.ts`), and the same question reads:

> You said, "I learned to raise scope risk earlier." What specifically changed
> in your process afterward, and how did you handle stakeholders who pushed back
> on reducing scope?

Verified on 24 follow-ups, then on the full 51 of the shipped run. The first
run is kept beside the final one as
`artifacts/persona-eval-live-gpt-5.6-luna-before-quote-fix.{txt,json}`, because
a record that only shows the version that passed would not show why the sentence
was changed.

**The two `gpt-5.6-luna` columns are also a measurement of noise.** The probe
sentences are only sent on a `PROBE_ACTION` move, and only the probing-depth-9
arm makes one. The other 13 arms sent the model identical requests in both runs,
and their results still differ: warmth by 0.3 (+0.8, then +0.5), pace by 0.2,
strictness by 0.2, and pace's lower bound crossed zero (+0.02, then −0.12). So at
51 generations per cell a point estimate moves by up to about a quarter of a
point for nothing but sampling, and a verdict that rests on the edge of an
interval, as pace did in the first run and strictness did on the old judge, is
not a result either way.

---

## 6. Faults found by running the harness

None would have been caught by reading the code. A fifth, found while moving to
a new model, is in §5: six of the seven probe notes never told the interviewer
to quote the candidate, and the previous models had been doing it anyway.

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

## 7. Limitations

- **Adjacent steps are untested.** 2, 5 and 9 only. Treat the dials as three
  reliable behavioural bands over a continuous instruction, and do not claim 8
  differs from 9 in the output.
- **One judge, unvalidated by people.** `gpt-6-luna` spreads its scores far more
  than the earlier judge did (a control's supportiveness 3.9 where the old one
  said 7.9), which is why strictness and warmth now show. It is a different
  generation from the interviewer but the same vendor, so shared blind spots are
  possible. Blind pairwise comparison, or counting, would be more sensitive, and
  §4 shows a case where counting and judging disagree about what moved.
- **One question, one round type, one answer.** A behavioural question answered
  well. Nothing here covers technical rounds or a poor answer.
- **n = 51 per cell, and it still moves.** §5 measures the noise: identical
  requests gave point estimates up to 0.3 apart and moved an interval's edge
  across zero. Warmth and pushback are within a few multiples of that, so
  "clear of zero" in one run is not a promise for the next. Read each figure as
  its interval, not its centre.
- **The answer is deliberately a good one.** Against a vague answer the engine
  returns `DRILL_SPECIFICITY` for every persona and four dials switch off — by
  design. Measuring a dial requires an answer that has cleared the fundamentals,
  which is itself a finding about when the dials apply.
- **The comparison across judges is not clean.** The `gpt-4o-mini` row of the
  history was judged by `gpt-4o-mini`; `gpt-5-mini` and `gpt-5.6-luna` by
  `gpt-6-luna`. Only the second pair can be compared to each other. The
  18 September run also measured an interviewer the app no longer used (the
  harness kept a default of its own after the app moved to `gpt-5-mini`), which
  is why `src/lib/models.ts` now holds one constant that both read and every
  run prints the model it used.
- **The run was made on an uncommitted tree.** The files that differ from the
  commit are documents, the UAT summary tooling and a formatting change; none is
  on the interviewer's request path, and the interviewer's own code is identical
  to the commit. The deterministic artifact says so in its stamp and asks to be
  regenerated from a clean tree before it is quoted.
- **The live run predates the persona changes of 21 October 2026.** Warmth and
  pushback now also reach the private note, and the three rules that told every
  persona not to sound warm were rewritten. Those changes target exactly the two
  smallest effects in §4, so §4 understates or misstates them until the run is
  repeated, and the warm and reserved arms of the experiment should be expected to
  move most.
- **No human raters.** Nothing establishes that any of this resembles a real
  interviewer.

---

## 8. Reproducing it

```bash
npm run eval:models                       # one tiny request per call site, ~0.1¢
npm run eval:persona                      # offline, free, byte-identical
npm run eval:persona -- --live            # 51 per cell, ~17¢, needs OPENAI_API_KEY
npm run eval:persona -- --json            # machine-readable

# The interviewer is the app's (src/lib/models.ts); the judge is gpt-6-luna.
# Reproduce the earlier rows of §5 by naming the interviewer:
INTERVIEWER_MODEL=gpt-5-mini npm run eval:persona -- --live
INTERVIEWER_MODEL=gpt-4o-mini JUDGE_MODEL=gpt-4o-mini npm run eval:persona -- --live
```

The default is 51 generations per cell. The harness prints the interviewer and
judge it used, refuses to run a judge of the same generation as the interviewer
without saying so, and exits non-zero if any request failed.

Artifacts: [`artifacts/persona-eval.txt`](artifacts/persona-eval.txt) and
[`artifacts/persona-eval-live.txt`](artifacts/persona-eval-live.txt) for the
shipped interviewer, and `persona-eval-live-gpt-5-mini`,
`persona-eval-live-gpt-4o-mini` and
`persona-eval-live-gpt-5.6-luna-before-quote-fix` for the other rows of §5. The
deterministic artifact is stamped with the commit it came from and refuses to be
quoted if generated from a tree with uncommitted changes.

The headline numbers are asserted in `src/eval/persona-sweeps.test.ts` and run in
CI, so a threshold that moves breaks the build and names this document. That, not
a dashboard, is what keeps these figures from going stale.

---

## 9. Sources

Unchanged by this work; they justify the dial set, which is not what was measured
here. Compiled without internet access — check each against the original before
quoting (see [CHANGELOG.md](CHANGELOG.md)).

- arXiv 2608.10412 — default LLM interviewers issue deepening probes on 4.9% of
  turns. The baseline for probing depth.
- Amazon — Bar Raiser, and the "Dive Deep" leadership principle.
- HackerRank — interviewer archetypes, including the supportive one.
- SHRM — structured interviewing guidance.
