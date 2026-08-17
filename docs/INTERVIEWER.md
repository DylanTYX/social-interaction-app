# What the interviewer knows, and how it decides what to ask

Every question this app asks is model-generated. Nothing is drawn from a
question bank during an interview. So the only thing that makes one round
behave like a system design interview and the next like an HR chat — and the
only thing that stops the fourth interviewer re-asking the first one's question
— is what reaches the prompt, and when.

This document is that, in order: what a round **is**, what the interviewer knows
**before** it starts, what it learns **during**, how it picks the next question,
and what crosses from one round to the next.

- Whether the _scoring_ can be trusted: [`EVALUATION.md`](EVALUATION.md)
- What the _coach_ does after the fact: [`COACHING.md`](COACHING.md)
- What the prompt _costs_: [`TOKEN-COST.md`](TOKEN-COST.md)

---

## 1. A round type is five things

`ROUND_TYPE_SPECS` in [`src/lib/round-types.ts`](../src/lib/round-types.ts) is a
`Record<InterviewRoundType, RoundTypeSpec>` — one object literal per type, and a
missing field is a compile error. Adding a seventh round type is one entry in
that file and nothing else.

Five of its fields decide how the round behaves:

| Field                 | What it does                                              | Where it lands                                                                                       |
| --------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `rubric`              | The criteria the answer is scored on                      | The **analyzer's** prompt, and the round card in the wizard                                          |
| `opening`             | The interviewer's first question, as an instruction       | The opening turn                                                                                     |
| `continuationOpening` | The same, when this is **not** the first round of the day | The opening turn                                                                                     |
| `playbookId`          | How to run this kind of round, turn to turn               | The stable prompt layer                                                                              |
| `family`              | `behavioural` or `technical`                              | The analyzer's schema branch, the decision-engine ladder, and whether questions carry between rounds |
| `supports.codeEditor` | Whether the candidate can answer in a code editor         | The interview screen                                                                                 |

### The six types

| Type                       | Rubric (what it is scored on)                                                               | Family      | Editor |
| -------------------------- | ------------------------------------------------------------------------------------------- | ----------- | ------ |
| **Intro / screening**      | Clarity, motivation, fit, concision                                                         | behavioural | —      |
| **Behavioral**             | STAR, clarity, specificity                                                                  | behavioural | —      |
| **HR / People**            | Motivation, values fit, logistics, questions for us                                         | behavioural | —      |
| **Technical SWE**          | Problem framing, approach, correctness, complexity, communication, edge cases, code quality | technical   | ✅     |
| **System design**          | Requirements, architecture, depth, tradeoffs, scalability, communication                    | technical   | —      |
| **Case / problem solving** | Problem framing, structure, tradeoffs, depth, communication                                 | technical   | —      |

**The rubric is not decoration.** It is interpolated verbatim into the
analyzer's prompt (`Primary rubric: …`), so the same string that labels the round
in the wizard is the standard the answer is graded against. `family` then picks
which JSON schema the analyzer fills in — STAR fields for behavioural rounds,
`problemFraming`/`correctness`/`complexity`/`edgeCases`/`codeQuality` for
technical ones — and which ladder the decision engine walks.

**Why only one type has an editor.** `system_design` and `case` are deliberately
prose. Without code execution or a diagram surface, an editor there invites
pseudocode into a box graded on requirements and tradeoffs. `technical_swe` is
scored on `codeQuality` and `correctness`, which a chat box cannot accept — that
is the whole reason the editor exists.

### The opening question

Every round used to open with one hardcoded line ending "…and ask if they're
ready to begin". Two things were wrong with it: a system design round opened
exactly like an HR round, and the candidate's first word was always "yes" —
which the trivial-answer guard skips, so the first exchange of every interview
was never scored while still consuming a turn.

Now each type opens on a question that belongs to it:

| Type          | `opening` (round 1)                                                                                            | `continuationOpening` (round 2+)                                                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| screening     | Ask them to introduce themselves and what drew them to this role.                                              | Skip the background tour — a colleague already took it. Ask what specifically drew them to this role, and why now.     |
| behavioral    | Ask them to tell you about themselves and how they got to where they are now.                                  | Skip the career walkthrough. Pick one thing the earlier rounds left unproven and ask for a specific story about it.    |
| hr            | Ask them to walk you through their background and what they are looking for.                                   | Skip the background walkthrough. Ask what they want from their next role and what would make them say yes to this one. |
| technical_swe | State the coding problem concretely and in full, then invite them to think out loud before writing code.       | _Same, plus:_ say plainly that this round is hands-on, since the earlier ones were conversation.                       |
| system_design | State the system to design and the scale it must handle, then ask how they would approach it.                  | _Same, plus:_ pick one adjacent to work the earlier rounds surfaced.                                                   |
| case          | Set out the business situation — company, market, decision — then ask how they would structure their thinking. | _Same, plus:_ anchor it to a domain the earlier rounds show they know.                                                 |

The three behavioural types get a genuinely **different** question in a later
round, because theirs is the one that collides — the default loop is screening
then behavioural, which without this asks for a background twice. The three
technical types keep their instruction and gain a bridging clause, because a
system design round has to state a system whether it is round one or round four.

These are instructions, not lines to recite. The persona supplies the name,
seniority and industry; the opening only tells the model to use them.

### The playbook

A short standing instruction for how to _run_ the round, pinned by
`playbookId` rather than matched by tag. From
[`interviewer-playbooks.ts`](../src/lib/interviewer-playbooks.ts):

| Round                | Playbook                                                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| screening            | "Keep it concise. Test motivation, role fit, and communication clarity."                                                                                                                                |
| behavioral           | "Probe missing STAR parts: situation, task, action, and measurable result."                                                                                                                             |
| hr                   | "Cover what a People partner actually asks: why this role and company, how they work with others, notice period and timing… Leave room near the end for their questions, and answer them in character." |
| technical_swe / case | "Make the candidate clarify constraints before solving. Ask about edge cases and complexity."                                                                                                           |
| system_design        | "Start with requirements and users, then high-level architecture, then deepen one component and tradeoffs."                                                                                             |

Up to two _more_ playbooks are selected per turn by tag — `vague-answer`,
`acknowledge-strength`, `one-question` — based on what the last answer looked
like. Those go in the volatile layer; the round's own playbook is stable.

---

## 2. What the interviewer knows before turn 1

The prompt is deliberately split into two system messages. The **stable** layer
is byte-identical for every turn of a round, which is what makes OpenAI's prompt
cache actually hit; the **volatile** layer changes per turn and must come after
it, or it would poison the cached prefix.

Before the candidate has said anything, the stable layer holds:

| Block                    | Source                                                                  | Constant for        |
| ------------------------ | ----------------------------------------------------------------------- | ------------------- |
| Interviewer instructions | `STATIC_INTERVIEWER_INSTRUCTIONS`                                       | Every session, ever |
| **Persona**              | `generatePersonaPrompt` — name, seniority, industry, and the four dials | This round          |
| **Scenario context**     | The role brief, plus this round's title, type, **rubric** and focus     | This round          |
| **Round playbook**       | `ROUND_TYPE_SPECS[type].playbookId`                                     | This round type     |
| **Loop brief**           | What earlier rounds found — §4                                          | Rounds 2+           |
| Company                  | The job description's employer, when recorded                           | This round          |
| Job description          | Only when short enough to inline whole                                  | This round          |
| **Resume**               | The candidate's document, verbatim                                      | This round          |

Two things worth being precise about:

- **The resume is sent whole, not summarised.** An earlier version distilled it
  into a ~400-token profile and sent that instead, so the interviewer had never
  read the candidate's actual words while its prompt label claimed otherwise.
- **The job description is in two places by design.** Inlined whole it is
  identical every turn and belongs in the prefix; retrieved excerpts are chosen
  per question and belong in the volatile layer.

The interviewer does **not** know its position in the loop. The round line says
`Interview loop round: {title}`, not "round 2 of 4". The presence of a loop brief
is what tells it this is a continuation — deliberately, because round 1 of a
loop is still a cold open.

---

## 3. What it learns during the interview

Each turn, four blocks are assembled into the volatile layer. Together they are
the entire memory the interviewer has of the round in progress.

### a. The coaching signal — what the last answer scored

The answer is analysed **before** the next question is written, and the verdict
is fed back as a private steering block:

```
Coaching signal for your next question (private; never read aloud):
- The candidate's last answer scored 62/100.
- Recommended approach: DRILL_SPECIFICITY — the answer named no metric or decision.
- Make the next question focus on: concrete ownership.
- Aim for difficulty 7/10.
- Briefly acknowledge this strength first: clear structure.
- The main gap to close is: no quantified result.
```

This is the loop that makes the interview adaptive. The strategy is picked by
[`decision-engine.ts`](../src/lib/decision-engine.ts) from the rubric actually in
play — a behavioural round walks a STAR ladder (specificity < 4 →
`DRILL_SPECIFICITY`, ownership < 5 → `CHALLENGE_OWNERSHIP`, score > 75 →
`ACKNOWLEDGE_STRENGTH`), a technical round walks framing → approach →
correctness → complexity → code quality. Difficulty is arithmetic:
`round(score/10)` adjusted by repetition and by `(strictness − warmth)/4`, which
is how a stricter persona asks harder follow-ups on the identical answer.

### b. The questions already asked — verbatim

```
Questions you have already asked in this interview — do not ask these again,
or a reworded version of them:
- What was your role in resolving it?
- How did the team react?
```

The interviewer's own questions, extracted from its turns (the last sentence
ending in `?`, or the whole turn for imperatives like "Walk me through your
approach"), de-duplicated case-insensitively, oldest dropped first.

### c. The competency steer — what has not come up

Twelve competencies — conflict, failure, ambiguity, leadership, prioritisation,
data decisions, ownership, collaboration, communication, feedback, scale
tradeoffs, customer focus — each with an embedded probe sentence. Every question
the interviewer asks is embedded and matched against them above a cosine
threshold, so coverage accumulates as the round runs:

```
- Competencies not yet explored in this interview: ambiguity, feedback.
- Prefer a question that opens one of them, unless the coaching signal above
  points somewhere more urgent.
```

The starting point rotates by how many competencies are already covered.
Without that, every session steered toward conflict then failure in order, so an
"improvised" interview came out identical for every user.

### d. The rolling summary

Three turns are kept verbatim; everything older is compressed into four to seven
bullets under 180 words, refreshed periodically rather than every turn.

---

## 4. How repetition is actually prevented

There are three guards, and they are three because each one fails somewhere the
others do not. Being explicit about the seams matters more than the list:

| Guard                | Covers                      | Blind spot                                                                           |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------ |
| Rolling summary      | The gist of the whole round | Compresses; whether turn two's question survives to turn ten is up to the summariser |
| Asked-questions list | Exact wording, recent turns | Bounded by the transcript window — roughly the last six interviewer turns            |
| Competency steer     | Whole themes, not wording   | Silent at **both** ends: nothing covered yet, or everything covered                  |

The competency steer switching itself off once everything is covered is the
sharpest of these — that is exactly the point in a long round when repetition is
most likely, which is why the verbatim list exists at all.

**Within a round, these are the whole story.** None of them see another round.

---

## 5. How rounds talk to each other

A loop is **one `interview_sessions` row per round**, chained by a `loop_id`
column. Round 2 cannot read round 1's messages — the query is scoped by
`session_id`, and they are different sessions. The entire channel between them
is one string, written once at handoff into `launch_meta.loopBrief` and read
back verbatim into round 2's stable prompt layer.

It looks like this:

```
Notes from this candidate's earlier rounds today, shared by your colleagues.
Use them to follow up on open threads and avoid repeating ground already covered.
Refer to them naturally if it helps — never read them out or mention that you have notes.
Anything under "Already asked" has been put to them today — do not ask it again,
or a reworded version of it.

Recruiter screen (Intro / screening) — scored 72/100
  Came across well: clear motivation
  Still unproven: vague on impact
Technical 1 (Technical SWE) — scored 68/100
  Came across well: clear complexity analysis
  Still unproven: edge cases
  Already asked: "Design a rate limiter for an API gateway?"; "How would you
  handle the distributed case?"
```

### What crosses, and what does not

|                                    | Crosses | Scope                                          |
| ---------------------------------- | ------- | ---------------------------------------------- |
| Round title, type, average score   | ✅      | Every prior round                              |
| Top 2 recurring strengths and gaps | ✅      | Every prior round                              |
| **The questions actually asked**   | ✅      | **Same-family prior rounds only**, 4 per round |
| Competency coverage                | ❌      | Restarts empty each round                      |
| The transcript                     | ❌      | —                                              |

**Why questions are family-scoped.** Two technical rounds can independently land
on the same problem — that is the case worth preventing, and `technical_swe →
system_design` still dedupes because both can reach for "design a rate limiter".
A technical round's problems tell an HR interviewer nothing it can act on, so
carrying them there would be noise in a layer re-sent on every turn. Scores,
strengths and gaps carry regardless: "still unproven: quantifying impact" is
worth any later interviewer knowing.

**Why four.** This sits in the cached stable prefix, so it is re-sent on every
turn of every later round. Ten rounds of ten questions is a transcript, not a
colleague's note. The openers do not need carrying, because
`continuationOpening` already changes them.

**Why it is rebuilt, not appended.** The brief used to be built one round at a
time and string-joined onto the inherited value, so round 3 carried the
three-line preamble twice and round 4 carried it three times — duplicated
instruction growing inside the cached prefix. It is now rebuilt from every
session in the loop at each handoff, which emits the header once by
construction. Live loops self-heal on their next handoff.

**Why competency coverage does not carry.** The naive merge is worse than
nothing. The steer returns nothing once every competency is covered, so merging
round 1's coverage into round 2 shrinks the remaining set from turn zero, and
across four rounds plausibly switches the steer off for the whole back half —
exactly when it is most needed. Doing it properly needs a separate
"explored earlier, go deeper rather than reopen" branch, which is a change to a
scored path with its own eval implications.

---

## 6. What this does not do

Stated here rather than left to be discovered:

- **No topic-level tracking anywhere.** Coverage is a fixed twelve-slot
  taxonomy; "rate limiter" cannot be represented in it. Cross-round
  de-duplication is exact-ish string matching on the questions themselves.
- **The interviewer does not know its round number**, only whether a brief
  exists.
- **De-duplication is on wording, not meaning.** "What was the outcome?" and
  "How did that turn out?" are different strings; only the model's own reading
  of the do-not-repeat instruction stops the second.
- **Rounds cannot be reordered** in the wizard — only edited in place, appended
  or removed.
- **Whether any of this improves a candidate** is not measured here. The
  analyzer's scoring is validated in [`EVALUATION.md`](EVALUATION.md); that the
  personas genuinely differ is measured by `npm run eval:persona`; the questions
  themselves have never been evaluated.
