# Problem, requirements, and what satisfies them

What this project is for, what it has to do, and where each requirement is
implemented and checked. Written so a requirement can be traced to code and to a
test rather than asserted.

---

## 1. The problem

Interview practice today comes in three shapes, and each has the same hole.

**A question bank** — Glassdoor lists, LeetCode, "50 behavioural questions" —
asks the same things in the same order. It never notices that you dodged the
question, so the tenth question is no better aimed than the first.

**A human mock interviewer** adapts perfectly. They are also not available at
eleven at night, cannot be repeated ten times, and cost money per session. For
most candidates this is the thing they get once, from a friend, a week before.

**A general chatbot** will role-play an interviewer if asked. It will not grade
you against a rubric, will not push back when an answer is weak, and has no
memory of what it already asked across a conversation of any length.

**The common gap: nothing connects how you answered to what you get asked next.**
That loop — answer, judge, adapt — is what a real interview _is_, and it is the
thing none of the three do. It is what this project builds.

A second gap follows from it. A real hiring process is not one conversation, it
is a **loop**: a recruiter screen, two technical rounds, a hiring manager, each
with a different person who has been briefed by the last. No practice tool models
that, so nothing lets a candidate rehearse the day rather than the question.

## 2. Scope

**In scope.** Adaptive single-round and multi-round interview practice, in text or
voice, grounded on a real job description and the candidate's real resume, scored
against a round-appropriate rubric, with a report and a coaching path.

**Explicitly out of scope**, and the reasons are in
[DESIGN-DECISIONS.md](DESIGN-DECISIONS.md):

- **Executing candidate code.** Reviewed, never run.
- **A hire / no-hire verdict.** Scores and feedback, not a decision.
- **Languages other than English**, despite personas having a nationality.
- **Modelling culture or nationality as behaviour.** This is a hard exclusion on
  ethical grounds, not a backlog item — see §5.

---

## 3. Functional requirements

Each row names where it is implemented and where it is checked. `UAT n` refers to
a case ID in [UAT.md](UAT.md).

### Interview setup

| #   | Requirement                                                                   | Implemented in                                     | Checked by                                        |
| --- | ----------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------- |
| F1  | A user describes a role in free text and starts practising from it alone      | `simulate/setup`, `scenarios.ts`                   | `scenarios.test.ts`, UAT S6                       |
| F2  | A job description can be pasted or uploaded as PDF, and grounds the questions | `api/job-descriptions`, `jd-chunking.ts`, `pdf.ts` | `jd-chunking.test.ts`, UAT I4-I5                  |
| F3  | A resume can be pasted or uploaded, and the interviewer reads it whole        | `api/resumes`, `db/resume-prompt.ts`               | `resume-prompt.test.ts`, UAT I6-I8                |
| F4  | Documents are saved to a reusable library, editable and deletable             | `dashboard/resumes`, `dashboard/job-descriptions`  | `route.test.ts` × 2, UAT I8b                      |
| F5  | The interviewer persona is configurable on five axes plus four dials          | `persona-engine.ts`                                | `persona-engine.test.ts`, `eval:persona`          |
| F6  | One round, or many, composed by the user                                      | `interview-rounds.ts`                              | `interview-rounds.test.ts`, `round-types.test.ts` |
| F7  | Each round in a loop can have a different interviewer                         | `next-round/route.ts`, `loop-step.tsx`             | UAT T-loop                                        |

### The interview

| #   | Requirement                                                      | Implemented in                                             | Checked by                                                         |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| F8  | Every answer is scored against the round's own rubric            | `response-analyzer.ts`                                     | **`npm run eval`** — 88.9% band accuracy, 41.0 separation          |
| F9  | **The score steers the next question**                           | `decision-engine.ts` → steering block in `api/chat`        | `decision-engine.test.ts`; `eval:persona` for the difficulty curve |
| F10 | The interviewer does not repeat a question within a round        | `asked-questions.ts`, `competencies.ts`                    | `asked-questions.test.ts`, `competencies.test.ts`                  |
| F11 | **A later round knows what earlier rounds asked**                | `loop-brief.ts`, `next-round/route.ts`                     | `loop-brief.test.ts`                                               |
| F12 | A later round does not re-ask for a background it was briefed on | `round-types.ts` `continuationOpening`, `opening-brief.ts` | `opening-brief.test.ts`                                            |
| F13 | Each round opens on a question belonging to its type             | `round-types.ts` `opening`                                 | `opening-brief.test.ts`                                            |
| F14 | Technical rounds accept typed code, in text **and** voice        | `code-answer.ts`, `code-input.tsx`, both interview screens | `code-answer.test.ts`                                              |
| F15 | Voice mode transcribes speech and speaks replies                 | `speech-service.ts`, Azure Speech                          | `speech-service.test.ts`, UAT V1-V5                                |
| F16 | A session survives a closed tab and can be resumed               | `sessions/[id]/resume`, `chat-recovery.ts`                 | UAT T8 only — **`chat-recovery.ts` has no unit test**              |
| F17 | The candidate can stop early and still get a report              | `interview-session-state.ts`                               | UAT T9                                                             |

### After the interview

| #   | Requirement                                                           | Implemented in                              | Checked by                                |
| --- | --------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------- |
| F18 | A report with an overall score, per-answer scores, strengths and gaps | `simulate/report/[id]`                      | UAT R1-R5                                 |
| F19 | On-demand coaching: a suggested answer, a rewrite, targeted tips          | `api/coach/suggested-answer`                    | `route.test.ts`, **`npm run eval:coach`** |
| F20 | Competency coverage — what the interview explored and what it did not | `competencies.ts`                           | `competencies.test.ts`                    |
| F21 | A combined report across the rounds of a loop                         | `api/loops/[loopId]`                        | UAT R7                                    |
| F22 | Progress over time, and a suggestion for what to practise next        | `dashboard/analytics`, `recommendations.ts` | `session-stats.test.ts`                   |
| F23 | Single-question drills without setting up a session                   | `dashboard/drills`                          | `question-bank.ts`, UAT D1-D3             |

### Account and data

| #   | Requirement                                          | Implemented in                         | Checked by                 |
| --- | ---------------------------------------------------- | -------------------------------------- | -------------------------- |
| F24 | Email/password auth; a user sees only their own data | Supabase auth + RLS on all nine tables | `route.test.ts` auth cases |
| F25 | Export all data as JSON                              | `api/me/export`                        | UAT A4                     |
| F26 | Delete interview history; account deletion cascades  | `dashboard/settings`, FK cascade       | UAT A5                     |

---

## 4. Non-functional requirements

| #   | Requirement                                                                       | How it is met                                                                                                                               | Evidence                                                           |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| N1  | **Scoring must be stable** — the same answer must not score 62 then 78            | `temperature: 0.1`, anchored 0-100 bands                                                                                                    | `npm run eval` reports mean σ = 1.39 across runs                   |
| N2  | **Scoring must be persona-blind** — a warm interviewer must not inflate the score | The analyzer takes no persona argument; cache key is `analyzer:${roundType}`                                                                | Asserted in `DEMO.md`; no persona in `analyzeResponse`'s signature |
| N3  | **Token cost must be measured, not assumed**                                      | Every call records to `llm_usage`; `npm run cost-report` prices it                                                                          | [TOKEN-COST.md](TOKEN-COST.md), with the cache-floor caveat stated |
| N4  | **A user's data must be unreachable by another user**                             | RLS on every table; retrieval RPC filters on `auth.uid()` **inside** the database                                                           | [DATA-MODEL.md](DATA-MODEL.md)                                     |
| N5  | **Untrusted text must not reach a system prompt**                                 | Input caps, `isRoundType` validation, `sanitizeNotes`, `collectAskedQuestions` skips user turns                                             | Route tests assert the injection cases directly                    |
| N6  | **Secrets must not reach the browser**                                            | Azure keys server-side; browser gets a short-lived token. A lint rule bars `@/lib/pricing` and `@/eval` from `src/app` and `src/components` | `eslint.config.mjs`; CI runs lint                                  |
| N7  | A turn must be atomic — no half-written turns                                     | `append_interview_turn` writes messages, analysis and session update in one transaction                                                     | Migration `0005`                                                   |
| N8  | The interview must degrade rather than fail on a bad model response               | `jsonrepair` fallback, truncation detection with retry, neutral defaults                                                                    | `response-analyzer.ts`; field completeness measured at 100%        |
| N9  | Usable on a laptop by a non-technical candidate                                   | Setup wizard, onboarding tour, command palette                                                                                              | [UAT.md](UAT.md) §5 usability checklist                            |

**N9 is the weakest of these** and the docs say so: the interview screen assumes
a desktop browser, and on a phone the composer and coaching rail have no
small-screen layout.

---

## 5. Ethical requirements

These are requirements, not aspirations, and two are enforced by tests.

| #   | Requirement                                                         | How                                                                                                                                                                            |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| E1  | **Nationality must never drive interviewer behaviour**              | `NATIONALITY_IS_BACKGROUND` instructs the model explicitly; a test asserts two personas differing only in nationality produce prompts differing by exactly the demonym         |
| E2  | **No culture corpus, no national aggregate scores**                 | Rejected on the record — Hofstede and GLOBE are national aggregates whose authors warn against applying them to individuals. See [DESIGN-DECISIONS.md §5](DESIGN-DECISIONS.md) |
| E3  | **No hire / no-hire verdict**                                       | The product returns scores and feedback. A tool that told a candidate it would not hire them, on a model's judgement, would be making a claim it cannot support                |
| E4  | **A low score must be a judgement, not a hedge**                    | The 0-100 scale is anchored with five explicit bands including "a confident, well-presented answer that is wrong belongs in the lower bands"                                   |
| E5  | **The candidate's own words must not be replaced by a summary**     | The resume is sent whole. The earlier distillation was removed because the interviewer had never read the candidate's actual words while the prompt label claimed it had       |
| E6  | **Limitations must be stated in the product**, not only in the code | `FEATURES.md` has a "Current limitations" section listing code-not-executed, voice metrics not saved, English only, and that scores are not comparable across interviewers     |

---

## 6. Requirements not yet met

Recorded here rather than left for a reader to discover.

| Requirement                               | Status                                                                                                  | Where it is tracked                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Scoring validated by more than one person | **Not met.** Every accuracy figure means "agreement with one author"                                    | `npm run eval:raters` prints the blind sheet; [EVALUATION.md](EVALUATION.md) |
| Coaching quality measured                 | **Partly.** The rubric is measured (20/29 → 29/29 criteria); the `--live` uplift arm has never been run | [COACHING.md](COACHING.md)                                                   |
| Rate limiting correct behind fan-out      | **Not met.** In-process, single-instance                                                                | [PRODUCTION-REVIEW.md](PRODUCTION-REVIEW.md)                                 |
| Content Security Policy                   | **Deferred** until the Azure Speech websocket origins are inventoried                                   | `next.config.ts`                                                             |
| Mobile interview screen                   | **Not met**                                                                                             | `FEATURES.md` limitations                                                    |
| Data retention policy                     | **Not met.** Data persists until deleted                                                                | [DATA-MODEL.md](DATA-MODEL.md)                                               |
| Rounds reorderable in the wizard          | **Not met.** Edit in place, append, remove only                                                         | [INTERVIEWER.md](INTERVIEWER.md)                                             |
