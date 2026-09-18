# The AI interviewer

How the interviewer decides what to ask, how its personality is parameterised
and bounded, and where every design decision came from. This is the annotated
record for the persona refinement — the same role `docs/DRILLS.md` plays for
the question bank. Written to be quotable in the project report.

---

## 1. The four layers, mapped to code

| Layer | What it decides | Where it lives |
|---|---|---|
| **1 — Role context** | What this job needs | JD retrieval per turn, query built from the previous turn's `nextFocus` (`app/api/chat/route.ts`) |
| **2 — Interview type** | What this round assesses | `ROUND_TYPE_SPECS[type].rubric` (`round-types.ts`), shared verbatim between the interviewer prompt and the analyzer prompt |
| **3 — Questioning strategy** | How the interview is conducted | `questioningStyle` on `PersonaConfig`: one prompt paragraph (`persona-engine.ts`) + a move-weight profile (`decision-engine.ts`) |
| **4 — Personality parameters** | The dials within the style | six 1–10 dials on `PersonaConfig`, each consumed numerically (§5) |

Underneath all four sits the evaluation engine — analyzer rubrics, the
strategy ladder, competency coverage — which is the research's "systematic
interviewer": the structure is always there; the persona only decides how it
sounds and which moves it favours.

### The invariant: personality never changes the scoring rubric

`analyzeResponse` takes no persona argument. Its prompt cache key is
`analyzer:${roundType}` — it *cannot* vary by persona. A strict interviewer
and a warm one score the same answer identically; persona changes what gets
asked next, never what the answer was worth. `docs/DESIGN-DECISIONS.md` states
it as "nobody scores better by picking a kinder interviewer."

This is not a convenience — it is the structured-interviewing position (SHRM):
standardised evaluation criteria reduce bias, and an interviewer's manner must
not leak into the grade. Every feature below was built inside this constraint.

## 2. The pipeline

```
  PERCEPTION                POLICY                  EXPRESSION            EVALUATION
  what was said        what to do about it        how it sounds         what it's worth
──────────────────   ─────────────────────────   ──────────────────   ─────────────────
analyzer (LLM)    →  decision-engine ladder   →  persona prompt    →  analyzer scores
+ behavioral signal  + evidence-probe selector    + style paragraph     (persona-BLIND;
  detection            (gated by probingDepth)    + steering block      unevidenced
  (deterministic,    + curveball selector           quotes the exact     claims cap the
  quotable)            (seeded, dial-biased)        word)                relevant score)
```

The turn cycle: **Question → Answer → Signal Detection → Evidence-Gap Probe →
New Evidence → Competency Score.** The probed answer is scored as its own
turn, so "evaluate the evidence the probe produced" falls out of the existing
turn structure rather than needing new machinery.

## 3. Behavioral signal detection

The interviewer does not take wording at face value. "Involved" is not "in
charge"; "participated" is not "led"; "we decided" names no decider. Seven
typed signals are detected **deterministically** (`detectBehavioralSignals`,
`text-metrics.ts`) — regexes over fixed phrase alternatives, no LLM call:

| Signal | Fires on | The probe it earns | Ladder move |
|---|---|---|---|
| `OWNERSHIP_AMBIGUOUS` | "involved in", "participated in", "helped with", "was part of", "contributed to" | *You said "‹marker›" — what specifically were you responsible for?* | `CHALLENGE_OWNERSHIP` |
| `DECISION_OWNER_UNCLEAR` | "we decided/chose/agreed" with no "I decided/proposed" anywhere | *What was your role in that decision?* | `CHALLENGE_OWNERSHIP` |
| `LEADERSHIP_CLAIM_UNVERIFIED` | "I led/drove/owned/was in charge of" | *What did leading it involve — which decisions were yours?* | `PROBE_ACTION` |
| `EXTERNAL_ATTRIBUTION` | "wasn't my fault", "they didn't deliver", "beyond my control" | *What part of that was within your control?* | `CHALLENGE_OWNERSHIP` |
| `IMPACT_UNQUANTIFIED` | "significantly faster" etc. **and** zero metrics in the answer | *How did you measure that?* | `EXPLORE_RESULT` |
| `TECHNICAL_CLAIM_UNVERIFIED` | "I optimized/scaled/fixed" **and** no mechanism **and** no metric | *What was the bottleneck, and how did you determine it?* | `DRILL_SPECIFICITY` |
| `LEARNING_UNVERIFIED` | "I learned/realized" | *What changed in how you work afterwards?* | `PROBE_ACTION` |

Three principles, all load-bearing:

1. **Signals trigger probing, never deductions.** "I led" is a claim to
   *verify*, not a phrase to reward; "we" is clarified, not penalised. The
   marking happens downstream, on the evidence the probe produces.
2. **Every marker is verbatim.** Detection is deterministic so the
   interviewer, the coach and the report all quote words the candidate
   actually said. An LLM paraphrase cannot make that guarantee — and quoting a
   word the candidate never used is worse than not quoting at all. (The
   markers are also safe to interpolate into prompts *because* the regexes
   have no free captures: a marker can only ever be one of the lexicon's own
   phrases.)
3. **Precision over recall.** A missed signal costs nothing — the LLM analyzer
   still judges holistically. A false one accuses a candidate of hedging words
   they chose deliberately. So "we decided" is silent when "I proposed"
   appears anywhere, and "I optimized" is silent once a mechanism ("by adding
   an index") or a number backs it.

One probe per turn, priority-ordered (ownership first), gated by the
`probingDepth` dial — with one exception: **two or more diffuse phrases with
no leadership claim anywhere fires at any depth.** An answer that is all
"helped with" and "involved in" has left its central question unanswered no
matter how gentle the interviewer is.

Where the signals go: the analyzer's user message (uniform for every persona,
with the instruction *score evidence, not claims*), the decision engine (the
probe), the drill coach (tips cite the exact word), and the report (up to
three quoted markers per turn with a plain reading).

## 4. Curveballs

Two moves beyond the classic ladder, chosen by `maybeCurveball`
(`decision-engine.ts`):

- **`PIVOT_TOPIC`** — leave the thread; aim at a competency the coverage
  tracker knows is unproven. A pivot without a destination is a weaker move
  than a twist, so with no uncovered competency the twist wins outright.
- **`HYPOTHETICAL_TWIST`** — bend the candidate's own scenario: change one
  constraint and ask what breaks; ask what they'd have done had their approach
  failed.

**The precedence rule:** curveballs only ever replace the two "answer is fine"
outcomes (`ACKNOWLEDGE_STRENGTH`, `PROBE_ACTION`). A vague answer still gets
`DRILL_SPECIFICITY`; an unowned claim still gets its probe (probes outrank
curveballs). Real interviewers pivot when a thread is done — not mid-weakness.

**Seeding, not randomness.** The trigger is a hash of `(sessionId, turnIndex)`
run through murmur3's finalizer (raw FNV-1a's low bits barely moved across
sequential turns). No `Math.random()` in the engine, ever: the decision engine
is pure, the eval harness replays it, and the chat route re-derives decisions
after a late analysis on the promise that identical input gives identical
output. *Unpredictable to the candidate* and *reproducible to the harness* are
compatible requirements, because the candidate never sees the seed.

## 5. The parameters: how 14 candidates became 6 dials

The candidate pool: the research's 13 interviewer attributes plus the
professor's curveball requirement. **The filter: a dial ships only if it is
(a) backed by a named source, (b) consumed numerically by the policy, and
(c) pulling a lever no other dial pulls.** (b) exists because two dials —
pace and pushback — had shipped as prompt prose only, and a slider that
changes nothing measurable is a lie in the UI; (c) is why "parameters beat 50
personas" works at all — only orthogonal parameters compose.

| Candidate | Verdict | Rationale |
|---|---|---|
| Warmth | **SHIP** (existed) | Supportive archetype (HackerRank). Consumed: confidence arithmetic, slow-down gate, and an acknowledgement allowance in words (0 at 1, 11 at 10). |
| Strictness | **SHIP** (existed) | High-bar archetype (Amazon Bar Raiser). Consumed: confidence, difficulty, a specifics floor, a re-ask allowance, and an acceptance bar stated on the analyzer's own scale (45/100 at 1, 90/100 at 10). |
| Pace | **SHIP** (existed) | Attribute table. Consumed: TTS rate (voice), pacing prose, and a per-question word budget (57 words at 1, 30 at 10) — the one directive that reaches a *typed* interview. |
| Skepticism | **SHIP** as `pushback` | Same lever; storage name kept for saved personas. Consumed: curveball twist/pivot weighting, five challenge rungs, and a budget of unsupported claims allowed to pass (5 at 1, **0** at 10). |
| Probing depth | **SHIP** (new) | Attribute table; Amazon "Dive Deep"; arXiv 2608.10412 (default LLM interviewers deepen on 4.9% of turns — probe frequency is *the* documented gap). Consumed: the signal→probe gate, and a follow-ups-before-moving-on floor. **Pointer 1's control knob.** |
| Unpredictability | **SHIP** (new) | The professor's requirement verbatim; adversarial archetype's deliberate ambiguity. Consumed: curveball probability. **Pointer 2's control knob.** |
| Patience | DEFER — no honest consumer | Text turns are discrete; voice silence handling is a product constant (`SILENCE_SUBMIT_MS`) that persona roleplay must not break. |
| Helpfulness | DEFER — with the hint ladder | Its only honest consumer is the hint-ladder feature, itself deferred. Ships together with it. |
| Adaptability | ABSORBED — it is the engine | Fixed→Adaptive *is* the analyzer→ladder→steering loop, always on. A dial would let a persona ignore the answer — the arXiv failure mode, not a style. |
| Formality | ALREADY REPRESENTED | `communicationStyle` is this axis; a second dial would alias it. |
| Pressure | REJECTED — not orthogonal | Emergent from strictness + pushback + pace + the `stress` style, which is its packaged, opt-in form. |
| Feedback frequency | REJECTED — violates the invariant | Mid-interview evaluative feedback leaks evaluation through the persona, and it is what made the interviewer read as a tutor. `ACKNOWLEDGE_STRENGTH` no longer means praise: the model is shown it as `RAISE_THE_BAR` and told not to compliment the answer. Feedback belongs to the coach and report, persona-blind by design. |
| Breadth | COVERED by Layer 3 + coverage | The `deep_dive`↔`conversational` axis plus `PIVOT_TOPIC`'s coverage targeting. |
| Technical depth | NOT A PERSONALITY | What the interviewer knows deeply is Layers 1–2 (round type + JD). A "shallow senior engineer" is roleplay incoherence, not a parameter. |

**Net: 6 shipped (4 existing, 2 new), 2 deferred with named dependencies, 3
already represented elsewhere, 2 rejected, 1 absorbed into the engine.**

### Orthogonality: six dials, six levers

| Dial | The one lever it pulls | Steps of 10 it resolves |
|---|---|---|
| `strictness` | the bar an answer must clear | 10 |
| `warmth` | acknowledgement + slow-down behaviour | 10 |
| `pace` | tempo (TTS rate + question length) | 10 |
| `pushback` | challenge intensity (twist weighting + claims contested) | 10 |
| `probingDepth` | evidence-probe frequency | 9 |
| `unpredictability` | curveball frequency | 10 |

No two share a lever, and the two new dials are exactly the professor's two
requirements — one control each. The parameter set was derived, not picked.

**One caveat on orthogonality, found by measuring rather than by review.**
Pushback and `questioningStyle` are not independent: the twist/pivot split is
`pushback - 5 + styleBias`, so the value at which pushback starts twisting moves
with the style — 2 under `stress`, 8 under `supportive`. The dials compose, but
this pair interacts, and the table above would have hidden that.

## 6. Questioning styles

`questioningStyle` is one field with two effects: a prompt paragraph
(expression) and a move-weight profile (policy). Six ship:

| Style | Backing | In one line |
|---|---|---|
| `conversational` | realism default | natural transitions, picks up the candidate's threads; pivots freely |
| `supportive` | HackerRank candidate-experience guidance | room to think, clarifies, never pressures; curveballs rare |
| `socratic` | Microsoft: how candidates break down, choose, plan | answers with the next question; twists over pivots |
| `deep_dive` | Amazon "Dive Deep" | one thread, drilled to the bottom; pivots suppressed |
| `bar_raiser` | Amazon Bar Raiser programme | evidence required for every claim; challenges weighted |
| `stress` | adversarial archetype — **opt-in, never a default**, per SHRM's caution that stress tolerance ≠ job ability | pressure on, reassurance off |

The other six research archetypes are mapped, not dropped: **systematic** is
the hidden engine itself (ladder + rubric + persona-blind analyzer);
**teaching/coaching** is the drills coach, deliberately outside assessment;
**executive** is the HR/behavioural round type (a role, not a style); **domain
expert / generalist** is round type + JD retrieval (Layers 1–2); **hinting**
is the deferred hint ladder.

The six preset personas carry styles that summarise the dials they already had
— Aisyah Rahman (strictness 9, pushback 9) was always a bar raiser; the field
just names it.

## 7. Measured, not asserted

Full method, results and limitations: **[PERSONA-EVAL.md](PERSONA-EVAL.md)**.
The headlines:

- **Every dial is consumed, and almost every step of it does something.**
  Swept one dial at a time with the others held at 5: strictness, warmth, pace,
  pushback and unpredictability each produce **10 distinct behaviours across
  their 10 settings**; probing depth produces 9, because depths 6 and 7 select
  the same probe tier. Offline, free, byte-identical, and pinned by tests that
  run in CI — `npm run eval:persona`.
- **The ends of a dial are distinguishable in the output.** 12 generated
  follow-ups per cell, rated by a judge never told the persona: strictness 2→9
  raises demandingness **+0.7** (95% CI [0.3, 1.3]), warmth 2→9 raises
  supportiveness **+0.7** ([0.3, 1.0]), and pushback 2→9 raises topic shift
  **+0.5** ([0.1, 1.0]). Pace correctly shows **no** effect on any axis, which
  was predicted before the run: its lever is the speech rate.
- **Adjacent steps are not proven distinguishable.** The experiment tests 2, 5
  and 9. It says nothing about 8 versus 9, and the report does not claim it.
- **Eight of the nine questioning strategies are used** across a ladder of
  answer qualities, `DRILL_SPECIFICITY` at 25% rather than by default. But
  within one answer quality the move is almost fully determined — the persona
  cannot override a weakness-driven choice. Variety over an interview comes
  from the candidate's answers changing, not from the dials.
- **Probe rate** — seven hedged answers, one per signal type, through the real
  lexicon: 29% probed at probing depth 2, 57% at 5, 100% at 9. Baseline:
  default LLM interviewers issue deepening probes on **4.9% of turns**
  (arXiv 2608.10412), the failure mode this design exists to beat.

Two faults this harness found by being run rather than read: the `--live` arm
had never executed at all — it requests a JSON response format that OpenAI
rejects unless a message contains the word "json", so every judge call returned
400 — and the steering block was cancelling its own topic pivots two lines
below itself. Both are fixed; both are written up in PERSONA-EVAL.md.

## 8. Deferred, with dependencies

| Deferred | Ships when |
|---|---|
| Hint ladder + `helpfulness` dial | as one feature — the dial's only honest consumer is the ladder |
| `patience` dial | if a mode ever exists where the interviewer can wait |
| Cross-turn integrity checking ("earlier you said you designed it…") | needs claim memory across turns — a summarised claims ledger per session |
| Plan-build-review interviewing (HackerRank 2026) | a different round type, not a persona feature |

## 9. Sources

| Source | Used for |
|---|---|
| [Microsoft — Technical Interviewing](https://careers.microsoft.com/v2/global/en/hiring-tips/technical-interviewing) | what interviewers probe: decomposition, ambiguity, choices, testing; the Socratic backing |
| [Amazon — How Amazon hires (Bar Raiser)](https://www.aboutamazon.com/news/workplace/how-amazon-hires) | the bar-raiser archetype: objective, evidence-oriented, consistent standard |
| [Amazon — Leadership Principles in interviews (Dive Deep)](https://www.aboutamazon.co.uk/news/working-at-amazon/amazon-leadership-principles-interviewer) | the deep-dive archetype; concrete-evidence probing |
| [SHRM — Reducing bias in hiring](https://www.shrm.org/topics-tools/news/talent-acquisition/7-practical-ways-to-reduce-bias-hiring-process) | the persona-blind scoring invariant; the stress-style caution |
| [HackerRank — Interview best practices](https://support.hackerrank.com/articles/5533854049-hackerrank-interview-best-practices) | standardised questions, rubrics — the hidden structured engine |
| [HackerRank — Candidate experience](https://support.hackerrank.com/articles/6477583642-ensuring-a-great-candidate-experience) | the supportive archetype |
| [HackerRank — AI interviewer guide](https://www.hackerrank.com/blog/ai-interviewer-for-technical-screening-a-practical-guide-for-engineering-teams/) | AI-interviewer calibration, follow-ups, false negatives |
| [HackerRank — Technical interviews in 2026](https://www.hackerrank.com/blog/what-a-technical-interview-looks-like-in-2026/) | plan-build-review as deferred future work |
| [MIT CAPD — the STAR method](https://capd.mit.edu/resources/the-star-method-for-behavioral-interviews/) | specific-evidence expectations behind the behavioural rubric |
| [Caltech HR — Behavioral Interview Guide](https://hr.caltech.edu/departments/recruiting-services/behavioral-interview-guide) | competency-organised probing: accountability, ownership, communication |
| [arXiv 2608.10412 — When the Interviewer Is a Bot](https://arxiv.org/abs/2608.10412) | the 4.9% deepening-probe baseline; the acknowledgment-heavy failure mode; the adaptivity judge dimension |
