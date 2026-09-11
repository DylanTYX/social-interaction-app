# Design decisions

Every choice here was made once, for a reason, and the reason is usually more
interesting than the choice. This is the record: what was decided, what the
alternative was, and what it cost.

Ordered by how much of the system each one touches. Where a decision has been
measured rather than argued, the measurement is named.

---

## 1. The score steers the next question, rather than only being reported

**Decision.** Each answer is analysed _before_ the next question is generated,
and the verdict is injected into the interviewer's prompt as a private coaching
signal.

**The alternative** is what almost every interview-practice tool does: ask
questions, collect answers, score at the end. That is a question bank with a
report attached.

**Why.** It is the only thing in this project that makes the interview _adaptive_
rather than scripted, and it is the whole claim of the work. A vague answer gets
drilled for specifics; a strong one gets pushed a level deeper.

**What it costs.** One extra model call per turn on the critical path, before the
interviewer can start streaming. The analyzer runs at `temperature: 0.1` and its
prompt is split so the scaffold caches, but the latency is real and is the price
of the feature.

**Measured, not asserted.** `npm run eval` reports the analyzer at 88.9% band
accuracy and 41.0 strong/weak separation against a keyword baseline's 13.0. If
the score were noise, everything built on it would be noise too — see
[EVALUATION.md](EVALUATION.md).

---

## 2. Everything stays in Postgres, including the vector search

**Decision.** Job descriptions are chunked, embedded with
`text-embedding-3-small`, and stored in `pgvector` inside Supabase. Retrieval is
a Postgres RPC.

**The alternative** is a dedicated vector database — Pinecone, Weaviate, Qdrant.

**Why.** Row-level security. The retrieval RPC filters on `auth.uid()` _inside
the database_, so a user's job-description chunks are covered by exactly the same
ownership rule as every other table. An external store cannot do that: it would
need its own authorisation model, kept in sync by application code, and a bug
there leaks one candidate's job description into another's interview.

**What it costs.** pgvector's index options are narrower than a purpose-built
store's, and at a corpus of millions this would be the wrong call. At one user's
job descriptions it is not close.

**A related decision:** short documents skip retrieval entirely. At four chunks
or fewer, "retrieval" is just reassembling the document, so it is inlined whole —
which also moves it into the cacheable prefix.

---

## 3. The prompt is split into a stable and a volatile layer

**Decision.** Two system messages. Instructions, persona, scenario, round
playbook, loop brief and resume are constant for a round and form a long
cacheable prefix; the coaching signal, asked-question list, coverage steer and
rolling summary change per turn and come after.

**The alternative** is one system message assembled per turn.

**Why.** OpenAI's prompt cache matches on an exact prefix. One block of volatile
text near the top invalidates everything after it, so the layering is what makes
caching possible at all.

**What it costs.** Ordering discipline that is easy to break. Anything added to
the stable layer must genuinely be constant for the round — which is why the loop
brief is written _once at handoff_ and read back verbatim rather than recomputed
per turn.

**The honest caveat**, recorded in [TOKEN-COST.md](TOKEN-COST.md): the cache has
a 1,024-token floor, and a bare session's stable prefix measures ~590 tokens. The
caching only fires once a resume or job description is attached. The layering is
correct; it is just not always doing anything.

---

## 4. One `interview_sessions` row per round of a loop

**Decision.** A four-round interview loop is four session rows chained by a
`loop_id` column, not one row with a rounds array.

**The alternative** is one session holding every round's transcript.

**Why.** Each round has its own persona, its own rubric, its own score and its
own report — and the report page, the resume path, the analyzer and the turn
counter all key on a session. Making a round a session meant every one of those
worked for loops without modification.

**What it costs, and this is the sharp edge.** Round 2 physically cannot read
round 1's messages: the query is scoped by `session_id`. Everything that has to
cross the boundary must be explicitly carried, and for a long time nothing was —
the handover brief said "avoid repeating ground already covered" while carrying
no record of what had been covered. That is now fixed by carrying the questions
themselves, but it is a cost of this shape, not an accident. See
[INTERVIEWER.md](INTERVIEWER.md) §5.

---

## 5. Nationality is biography, never behaviour

**Decision.** A persona's `nationality` is one adjective in one sentence, read
nowhere else in the prompt path. `NATIONALITY_IS_BACKGROUND` sits immediately after it and instructs
the model never to infer directness, formality, deference or expectations from
it. Interviewer behaviour comes from four explicit dials — strictness, warmth,
pace, pushback — and from communication style.

**The alternative**, which was considered and rejected: a culture corpus in
pgvector, retrieved by nationality, shaping how the interviewer behaves.

**Why not.** Three reasons, and the first is sufficient:

1. **It is national-origin stereotyping with extra steps.** A retrieval store
   keyed on nationality that returns behavioural claims makes the model generate
   behaviour _from national origin_, deterministically. That is what a stereotype
   is, implemented.
2. **It cannot be sourced at the granularity it needs.** Hofstede and GLOBE are
   _national aggregate_ scores whose own authors warn against applying them to
   individuals — the ecological fallacy. Driving one interviewer's behaviour from
   them misapplies them in exactly the way cautioned.
3. **It is not needed.** The four dials are explicit, controllable and
   measurable, which makes the claim falsifiable in a way a culture corpus never
   could be.

**Enforced, not just intended.** A test asserts that two personas differing only
in nationality produce prompts differing by exactly the demonym.

### 5a. Accent is the one exception, and it is acoustic

**Decision.** Nationality selects the interviewer's TTS voice, so an Indian
persona speaks English with an Indian accent. Nothing else changes.

This is a real amendment to the sentence above — nationality is no longer read
_nowhere_ else — so the boundary has to be stated precisely rather than waved
at. What the accent may touch is the audio. What it may not touch is anything
the model writes or the analyzer sees:

| Varies with nationality  | Does not                                              |
| ------------------------ | ----------------------------------------------------- |
| The Azure voice selected | The prompt — `persona-engine.ts` never sees the voice |
| Pronunciation            | Word choice, grammar, register, idiom                 |
| —                        | The transcript, the rubric, the score                 |

**No written dialect.** The interviewer never types "lah", never drops an
article, never has its English degraded to signal origin. That would be
caricature, and it would also corrupt the transcript the analyzer grades. The
sentences are identical; only the audio differs.

**Why this is not the culture corpus in disguise.** The rejected proposal made
_behaviour_ — how demanding, how deferential — a function of national origin.
This makes an _acoustic property_ one, which is the same relationship a person's
accent has to where they grew up. E1 is about behaviour and is untouched: the
dials still do all the work, and the demonym test still passes unchanged.

Two design choices follow from taking that line seriously:

1. **Voice gender is an explicit field, not an inference.** Guessing it from the
   persona's first name would be unreliable across exactly the international
   name set the randomiser produces, and would reintroduce inference-from-
   biography one field over.
2. **Nationality matching is exact, never fuzzy.** No substring or edit-distance
   matching. "Niger" is inside "Nigerian"; "Irish" is three edits from "Indian".
   An unmatched nationality gets neutral English and says so. Giving someone a
   neighbouring country's accent on a string coincidence would be the system
   asserting an inference it has no basis for.

**Nothing ships unheard.** Azure has real `en-XX` voices for fourteen locales;
those need no checking, because the accent is what the voice is. It has no
`en-CN`, `en-JP`, `en-SE` or `en-ES`, so those accents require a native-locale
voice reading English, which may come out accented, may come out near-native
(defeating the point), or may come out mangled. Every such mapping ships
`verified: false` and resolves to neutral English until a human has listened;
`persona-voice.test.ts` makes that a test rather than a promise. Method and
results: [`artifacts/voice-audition.md`](artifacts/voice-audition.md).

The audition reports a word error rate from feeding each clip back through
Azure's `en-US` recogniser. **That number ranks the listening order and decides
nothing**, and the reasoning is worth recording because the temptation to treat
it as a verdict is strong: a recogniser has no context and no top-down repair,
so it fails on speech a person follows without effort; it is Azure scoring
Azure; and at the low end it cannot tell a clear accent from no accent at all.
Nothing in the product ever runs a recogniser over the interviewer's voice — the
synthesised audio goes straight to the speaker — so a clip with a poor WER that
a listener can follow is perfectly shippable.

**The multilingual exclusion was an assumption, and it got tested.** Azure's
multilingual and HD voices are designed to sound native in every language they
support, so they were kept out of the table on the theory that they would carry
no accent. Brazilian failed a first pass on two voices, so the locale was
re-auditioned across every voice it offers, multilingual ones included. That
produced a plain voice for Brazilian women and a multilingual voice for
Brazilian men, which the listener judged to keep the accent. The rule is now a
default rather than a ban: a multilingual voice is listed only with an audition
behind it, and a test enforces that. Japanese and Vietnamese were removed rather
than left as nationalities the randomiser hands out without the accent. The
Japanese preset, Yuki Tanaka, was replaced by Aisyah Rahman (Singaporean) with
identical dials, so the demo's strict/warm contrast and its numbers are
unchanged; existing libraries are migrated in place. A typed nationality with no
accent voice still falls back to neutral English with the reason shown.

---

## 6. Code is reviewed, never executed

**Decision.** Technical rounds give a real CodeMirror editor with language
selection. The interviewer critiques the solution. Nothing runs it, and no tests
are run against it.

**The alternative** is a sandboxed runtime — Judge0, a container, a WASM
interpreter.

**Why not.** Executing user-supplied code is a security problem with a large
surface, and it is not the thing being assessed. The rubric scores problem
framing, approach, correctness, complexity, communication, edge cases and code
quality — a human interviewer at a whiteboard judges all seven without running
anything.

**What it costs, stated plainly in the product.** A candidate can submit code
that does not compile and be told it is well structured. `FEATURES.md` lists this
as a limitation rather than hiding it, and `round-types.ts` records that flags
for a whiteboard, a SQL runtime or screen share are deliberately absent because
they would "describe a product that does not exist".

---

## 7. One model per call site, chosen per call site — with overrides

**Decision.** Each model call has its own default, set by what its output is
for: `gpt-5-mini` where the output is the product (the interviewer's turns,
the coach's suggested answers), `gpt-4o-mini` where determinism or an eval
baseline matters more than ceiling (analyzer, summary, JD tidy-up, judges).
Every one is overridable by environment variable, and
[`model-params.ts`](../src/lib/model-params.ts) builds the request per family
so an override can cross families without a 400. The full per-site reasoning,
with prices, lives in [TOKEN-COST.md](TOKEN-COST.md) §"Which model runs where".

**The rule that survived from the earlier version of this decision**: never
two models _within_ one conversation. The opening turn once ran on `gpt-4o`
for a stronger first impression; two models meant two cache prefixes, so the
opening turn never warmed the cache the rest of the session used. Different
models across _different_ call sites keep separate caches anyway, so that
cost does not apply there.

**What it costs.** The analyzer's known failure — leniency toward fluent,
confident, wrong answers — might not survive a stronger model. That is
untested, and it is named as untested in [EVALUATION.md](EVALUATION.md); the
gated path is `ANALYZER_MODEL=gpt-5-mini npm run eval` against the committed
baseline.

---

## 8. Deterministic things are computed in code, not asked of the model

**Decision.** Word count, hesitation markers, qualifiers, self-corrections,
metric count and timeframes moved out of the analyzer's JSON schema into
[`text-metrics.ts`](../src/lib/text-metrics.ts).

**Why.** A model asked to count words will sometimes miscount them, and a field
the model can omit is a field that will be omitted. Six countable properties
became six fields that cannot be wrong or missing.

**What it cost, and this is recorded as a failure.** The schema change shipped
without running the harness that existed specifically to detect whether it
degraded scoring. [EVALUATION.md](EVALUATION.md) records the experiment as never
run rather than claiming it passed.

---

## 9. Server-owned fields are enforced by the database, not by the route

**Decision.** Session progress and usage recording go through
`security definer` functions (`supabase/migrations/0003_functions.sql`). `sanitizeLaunchMeta`
strips client-supplied values for anything the server owns — `loopBrief` most
importantly, since it lands verbatim in a system prompt.

**Why.** A route-handler check is one `if` away from being bypassed by the next
endpoint someone adds. A database function is the only write path.

**Why it matters more now.** The loop brief carries the _previous interviewer's
own questions_ into the next interviewer's system prompt. Both ends are
server-generated, and `collectAskedQuestions` skips `role: "user"` turns — so no
candidate-controlled text can reach a system message. That property is asserted
by a test, because it is the kind of thing a refactor silently breaks.

---

## 10. A `Record<InterviewRoundType, …>` instead of scattered switches

**Decision.** Everything a round type _is_ — label, icon, accent, rubric,
opening, continuation opening, playbook, family, editor support, defaults —
lives in one object literal per type in
[`round-types.ts`](../src/lib/round-types.ts).

**The alternative** is what was there before: four `Record` maps in two files and
four independent hand-rolled answers to "is this a technical round?".

**Why.** All four happened to agree; nothing made them agree. A fifth site — the
wizard's code-editor toggle — did not, and gated on practice mode instead of
round type, so a behavioural round could be handed a code editor and then graded
against the STAR rubric while being told to judge complexity.

**The proof the shape was needed:** `hr` was added as a round type and shipped
half-configured — label, rubric and playbook, but no default duration, no default
focus, no drill questions — because there was no single place where the gap would
show. A `Record` makes an incomplete entry a compile error.

---

## 11. Questions cross between rounds only where they can collide

**Decision.** The loop handover carries scores, strengths and gaps from every
prior round, but the _questions asked_ only from rounds of the same `family`.

**The alternative** is carrying everything, or carrying nothing.

**Why not everything.** This sits in the cached stable prefix and is re-sent on
every turn. A technical round's coding problems tell an HR interviewer nothing it
can act on, so carrying them is measurable cost for no benefit.

**Why not nothing.** Two technical rounds can independently land on the same
problem, and that is the case worth preventing. Family rather than exact type,
so `technical_swe → system_design` still dedupes — both can reach for "design a
rate limiter".

**Capped at four per round**, most recent kept: ten rounds of ten questions would
be a transcript rather than a colleague's note.

---

## 12. Competency coverage deliberately does _not_ cross rounds

**Decision.** The 12-competency coverage vector restarts empty each round.

**Why this is a decision and not an oversight.** The naive merge is worse than
doing nothing. `formatCoverageSteer` returns nothing once every competency is
covered, so merging round 1's coverage shrinks the remaining set from turn zero,
and across four rounds plausibly switches the steer off for the entire back half
— exactly when a long loop is most likely to repeat itself.

**What a correct version needs**, if picked up later: a separate `priorCoverage`
input rather than a merge, and a third branch that treats prior coverage as
"explored earlier, go deeper rather than reopen". That is a change to a scored
path with its own eval implications, not a field copy.

---

## 13. Evaluation harnesses are operator tooling, enforced by lint

**Decision.** `npm run eval`, `eval:persona`, `eval:coach` and `cost-report` are
not product features. A lint rule fails the build if anything under `src/app` or
`src/components` imports `@/eval`, `@/lib/pricing` or `@/lib/test-support`.

**Why a lint rule rather than a convention.** Next bundles whatever a route
entrypoint reaches. One `import { MODEL_PRICING } from "@/lib/pricing"` inside a
client component would ship the OpenAI rate card in a public chunk, with nothing
anywhere to notice.

**Why not `import "server-only"`**, which is the idiomatic guard: the eval
scripts run under plain `tsx`, outside Next's resolution conditions, so it risks
breaking the CLI. A lint rule cannot, and `npm run lint` already runs in CI.

---

## 14. The interviewer is never told which persona is "better"

**Decision.** The analyzer takes no persona argument. Its prompt cache key is
`analyzer:${roundType}`, with no persona in it.

**Why.** If the persona reached the rubric, a warm interviewer would score the
same answer higher than a strict one, and the score would measure the
interviewer rather than the candidate.

**What it costs, and the product says so.** Question _difficulty_ still scales
with strictness, so a supportive interviewer asks easier questions and those
answers genuinely score higher. Two 78s from different interviewers are not the
same achievement. The report names the difficulty band; the analytics trend does
not yet separate by persona, and `FEATURES.md` lists that as a limitation.

The full interviewer architecture built inside this invariant — the behavioral
signal taxonomy, the evidence probes, the curveball policy, the questioning
styles, and the derivation of the six persona dials — is documented in
`docs/INTERVIEWER.md`.

---

## Decisions still open

Honest about what has not been settled:

- **The rate limiter is in-process**, which is correct for one instance and wrong
  behind serverless fan-out. Recorded in
  [PRODUCTION-REVIEW.md](PRODUCTION-REVIEW.md) as not fixed, with the reason.
- **CSP is deferred** until the Azure Speech websocket origins are inventoried.
  The comment in `next.config.ts` says so rather than shipping a policy that
  breaks voice.
- **Rounds cannot be reordered** in the wizard — only edited in place, appended
  or removed.
- **`system_design` and `case` have no code editor.** Deliberate today, on the
  grounds that an editor invites pseudocode into a round graded on requirements
  and tradeoffs. Worth revisiting if a diagram surface ever exists.
