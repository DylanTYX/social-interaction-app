# Documentation changelog

What changed in the documents, when, and why — with every citation added or
altered named explicitly, so a claim in the report can be traced to the day it
entered the repository.

Code changes live in `git log`. This file exists for the things a reader of the
write-up would otherwise have to take on trust: a threshold that moved, a
behaviour that reversed, a source that was added after the fact.

**Standing caveat on sources.** References here were compiled without internet
access. Each is accurate to the best of the author's knowledge, and each should
be checked against the original before it is quoted in the report.

---

## 2026-10-21 (personas)

### The personas are made distinct: warmth reaches the private note, stops meaning praise, and the presets are spread out

**Documents:** `DESIGN-DECISIONS.md` (new §19), `PERSONA-EVAL.md` (status and
limitations: the live figures predate this), `INTERVIEWER.md` (warmth row; the
presets), `FEATURES.md` (persona cards, the report, voice styles), `DEMO.md` and
`presentation/SCRIPT.md` (the difficulty example is now 8/10 against 4/10, not
7/10 against 5/10), `artifacts/persona-eval.txt` (regenerated offline).

Users could not tell the personas apart, and the measurements agreed: warmth
moved a blind judge's supportiveness rating by half a point out of ten. Three
causes were fixed. Warmth and pushback lived only in the persona description at
the top of the prompt, while the model follows the private note after the
answer; both now reach the note. Three separate rules told every persona not to
praise, which also stopped any persona from sounding friendly; they now forbid
grading the answer and leave friendliness to warmth. And the six presets sat
between 4 and 9 on most dials; every preset dial is now 2, 5 or 9. Existing
accounts get the new presets on their next library load where the user never
changed a dial.

Two readouts were added so the difference can be seen: "How they interview" on
persona cards and in the editor, and "How [name] interviewed you" on the report,
counted from the move stored for each scored answer. For the four voices with a
fitting Azure speaking style, a warm persona is voiced with it; each was checked
for intelligibility with Azure's recogniser (0-3% word error with and without),
and no cold style is used because "serious" appeared to flatten the Chinese
accent.

**Not yet measured.** The persona harness was not re-run, because the API key had
no credit; until it is, the live figures in `PERSONA-EVAL.md` describe the previous
prompt.

**Sources:** Azure's live voice list for the configured region, read 21 October
2026, for which voices offer which styles. No other sources added.

## 2026-10-19 (UAT)

### The acceptance test gets a results log, and every case its own ID

**Documents:** `UAT.md` (version 1.1: new Section 6 on logging; IDs made
unique; one case added, five removed), `UAT-testers.csv` and
`UAT-case-log.csv` (new), `UAT-bug-log.csv` (Case and Workaround columns),
`REQUIREMENTS.md` (UAT references), the interim report's Section 5.19.

The plan had checkboxes but nowhere to put the results, and the report's
blanks — testers, exit-criterion verdicts, SUS, U11 and U12 for students —
would have been worked out by hand. They now come from three spreadsheets and
`npm run uat-summary`, whose rules are fixed before any session: the latest run
of a re-tested case counts, a developer's own runs count for the smoke gate
only, and a partial SUS questionnaire has no score. With empty logs it reports
every criterion as not yet measured rather than met.

Twelve IDs were used twice, so a result logged as "R5" or "A3" was ambiguous:
the session-management cases are now MS1–MS8, and the report cases R6–R11 are
renumbered. Five rows of an old Settings table, left after its replacement,
are gone, and R12 (the loop report) is added, because requirement F21 cited a
UAT case that did not test it. The functional pass is therefore 83 cases, not
87. Five other requirement rows cited cases that do not exist (T8, T9, T-loop,
D1–D3 for drills) and now cite the ones that check them. The usability
criterion now says what it always needed to: each of U1, U4, U6 and U7 must
average 3.5, not their pooled mean. This was settled before any result existed.

Practice logs with invented rows are in `docs/artifacts/uat-sample/`, every
row marked `Synthetic`; `npm run uat-summary -- --sample` reads them and
brackets its output with a SAMPLE DATA banner, as it does for any synthetic
row it finds in the real logs.

**Sources:** none added.

## 2026-10-19 (models)

### Both default models were retired by OpenAI; the app moved off them, and every number that depended on them was re-measured

**Documents:** `TOKEN-COST.md` (a new section on GPT-5.6 cache writes; the
prefix re-measured; the model section rewritten as the record of the
migration), `DESIGN-DECISIONS.md` (§7), `EVALUATION.md` (new §"Model
migration", per-round table, status), `PERSONA-EVAL.md`, `COACHING.md` (first
live results), `DEPLOYMENT.md`, `README.md`, `.env.local.example`,
`presentation/SCRIPT.md` (slide 3 named a model that was never the only one).

OpenAI retires the `gpt-5-mini` snapshot on 11 December 2026 (named
replacement `gpt-5.6-terra`) and `gpt-4o-mini` on 14 January 2027 (named
replacement `gpt-6-luna`). The interviewer and coach moved to `gpt-5.6-luna`,
not terra, which costs eight times the input rate; the analyzer, summary,
tidy-up and evaluation judges moved to `gpt-6-luna`. Each move followed a
harness run against a fresh run of the model it replaced, on the same tree:

- **Analyzer.** Same band accuracy (81.1%, 73 of 90 runs), wider separation
  (43.7 against 36.6), steadier (mean spread 1.36 against 2.01), and the two
  fluent-but-wrong fixtures better placed; all 17 of its misses are too high.
  The old model's fresh score was 81.1%, **not the 88.9% on record**, which
  dated from August, before two fixtures and the prompt changed.
- **Interviewer.** All six pre-registered dial expectations held on both models
  in the final runs, and every one of 153 topic pivots followed on both.
  Follow-ups were a third shorter (24 words against 37), time to first word a
  median 892 ms against 903 ms, and the run cost 30% less. **A regression the
  harness caught:** only one of the seven evidence-probe sentences ever told the
  interviewer to quote the candidate's words, and the old model had done it
  unprompted (50 of 51); the new one did not (0 of 51), and its first run
  missed one expectation (pace, by an interval edge). All seven now say so
  (`decision-engine.ts`); the same cell quoted in 24 of 24, then 51 of 51 in the
  full re-run. The first run is kept beside the final one. Because only the
  probe arm changed between the two runs, the other 13 arms are a measure of
  sampling noise: point estimates moved by up to 0.3.
- **Coach.** The first live coach run the harness has ever completed. It
  could not before: every judge prompt omitted the word "JSON" that JSON mode
  requires, so each fixture failed with a 400 (fixed in `run-coach-eval.ts`).
  The new coach lifts the analyzer's score by 11.4 points against 9.7 with the
  scorer held fixed, invents no quantities, and writes longer rewrites.
- **Summary and tidy-up** were spot-checked on both models against known facts
  (no harness covers them).

Other changes made on the way:

- `npm run eval:models` (new) sends one tiny request per call site, shaped
  like the app's own, on the current models or, with `--candidates`, the
  migration targets. About $0.001; it finds a refused request before a billed
  harness does.
- `src/lib/models.ts` is now the one place the defaults live, read by the app
  and by both harnesses. The persona harness had kept a `gpt-4o-mini` default
  of its own, so the live run committed on 18 September (`3e1aa38`) measured the
  interviewer the app had stopped using on 4 September (`fc062c8`).
- `model-params.ts` builds the request for GPT-5.6 and later: `none` in place of
  `minimal`, a temperature accepted only at `none`.
- `pricing.ts` carries the cache-write rate. On GPT-5.6 and later, tokens
  written to the cache cost 1.25× the input rate; measured with two identical
  2,299-token requests (2,296 written, then 2,296 read). The usage table does
  not store writes, so the rule is: in a prompt of at least 1,024 tokens,
  everything not read from the cache is priced at the write rate.
- The constant prompt prefix was re-measured with the real tokenizer: about
  **1,080 tokens, not 1,290**, at 4.8 characters to the token — above the
  1,024-token caching floor for all six presets, but by 29 to 77 tokens.
- `run-eval.ts` exits non-zero when a call fails, instead of printing PASS
  beside a NaN. `run-persona-eval.ts` wrote only 238 bytes of its 5.7 KB text
  artifact (the capture helper restored `console.log` before the async report
  finished); fixed.
- The committed coach artifact still said 29 criteria and a `case` round type;
  it now says 28 of 28 and `cs_fundamentals`.

**Sources:** OpenAI, _Deprecations_, _Pricing_, _Prompt caching_, _Latest model_
(the GPT-6 migration guide), and the model pages for gpt-6-luna, gpt-5.6-luna
and gpt-5-mini, all read online on 19 October 2026. The artifacts were generated
from a working tree with uncommitted changes, as their stamps say; none of those
files is on the interviewer's or analyzer's request path, and the deterministic
ones should be regenerated from a clean tree before they are quoted.

## 2026-10-18 (security, part 2)

### Usage rows are read-only, and the handover brief is bounded

**Documents:** `SECURITY.md` (LLM01 and LLM10 rows; new note on what
"server-owned" can mean), `DATA-MODEL.md`, `DEPLOYMENT.md`, `README.md` (a
fourth migration file).

`0004_usage_rows_read_only.sql` revokes `update` and `delete` on `llm_usage`
from signed-in and anonymous users. 0002 had revoked only `insert`, and
Supabase's default privileges grant the rest, so a user could edit or delete
their own usage rows through the REST interface — harmless to anyone else, but
the cost report is measured from those rows. Checked against a local Postgres
(PGlite): before the file, the owner could update and delete a row; after it,
both are refused, `record_llm_usage` still inserts, the usage page still reads,
and deleting a session still nulls the row's `session_id`.

The handover brief's strengths, gaps and earlier questions are now cleaned when
the brief is built — one line, capped, markers defused — so a row a user writes
directly cannot carry a block of instructions into the next round. Proving such
a row came from the server would need a privileged server key, which this
change does not add; `SECURITY.md` says why.

**Sources:** none added.

## 2026-10-18 (security)

### Marked documents, bounded retrieval, and the OWASP LLM mapping

**Documents:** `SECURITY.md` (new section mapping the OWASP Top 10 for LLM
Applications 2025), `TOKEN-COST.md` (re-measured prefix).

The resume, the job description (whole or as excerpts), the role brief and the
conversation summary now reach the interviewer inside labelled
`<<<BEGIN …>>>` blocks that a document cannot close, under a standing rule that
they are material, not instructions — OWASP LLM01's "segregate and identify
external content". The employer's name is kept to one line of 120 characters.
The two library list reads now have a rate limit, so all 38 handlers do. Job-
description retrieval has a 3-second deadline (`RETRIEVAL_DEADLINE_MS`), and a
failed or late retrieval, or a failed resume read, now continues without that
context instead of failing the turn. `npm run security-demo` prints what these
controls do to hostile input.

**Sources:** OWASP GenAI Security Project, *OWASP Top 10 for LLM Applications
2025*, read from the project's repository on 18 October 2026.

## 2026-10-18

### Coding answers get their own clock, and the problem is written down

**Documents:** `DESIGN-DECISIONS.md` (new §18, and an exception noted under
§16), `FEATURES.md` (code editor and voice sections), `DESIGN.md` (live
interview), the Tips & guides page.

Three thresholds moved. A code answer's limit is now 20 minutes in both
interview modes; it used to share the prose limit, 5 minutes typed and 3 in
voice, and sent the half-written function when it ran out. A Technical SWE
round is now planned at 5 minutes an exchange instead of 2, so a 25-minute
round expects 5 questions rather than 13. When the code clock runs out, the
answer is sent with a "[Time ran out — this is the code so far.]" note and the
interviewer is told to ask where the candidate got to.

One behaviour reversed for one case. A voice interview withholds the
interviewer's words (§16), but a coding problem is now always on screen: the
interviewer writes the statement in a `problem` fence, it is shown as a card
and pinned above the editor, and fenced code is never spoken.

**Sources:** none added.

## 2026-09-28

### The hero demo holds its height

**Documents:** `DESIGN.md` (one rule under Motion).

Reported as the landing page jumping while being read. The hero demo's
transcript had a fixed height and its Live coaching rail did not, so the taller
of the two set the demo's height: 564px while the rail listed its two starter
notes, 500px once it listed one, every loop. Measured through a full loop at
1440, 1024, 768 and 390 wide, it now holds one height at each (500px, and 420px
on phones, where the rail is hidden). The rail is held to the transcript's
height and shows the first of its notes, as the real rail would before
scrolling; each measure keeps room for a two-line label, so "Answer length"
wrapping beside its value no longer moves the notes.

**Sources:** none added.

---

## 2026-09-27

### The follow-up story is static again

**Documents:** `DESIGN.md` (the scroll-driven story and the pinned-section rule
removed; the mock rule says what the follow-up card shows; the setup wizard's
action bar described as `fixed`).

"It follows up on what you actually said" goes back to its original design: an
ordinary story, the text beside one card, with no scroll animation. What the
card claims stays corrected. It highlights "helped with", which the detector
flags, rather than "we improved things", which it does not. Its chip is the
report's reading, "Your personal role is unclear", rather than "Vague on
impact", which the app never says. And its follow-up asks what the engine
tells the interviewer to ask. `follow-up-example.test.ts` pins all three. The
trace's cards, the pinned frame and the rules written for them are gone.

Found while removing them: `DESIGN.md` still called the setup wizard's mobile
action bar `sticky`, two sections after its own Phones rule says it is
`fixed` because sticky drifted up the screen. The code is `fixed`; the
sentence now says so.

**Sources:** none added.

### The landing page says only what the app does

**Documents:** `DESIGN.md` (two rules under Landing page and the header's
breakpoint, one under Motion), `FEATURES.md` (Live coaching).

An audit of every claim on the landing page against the code. Most held. These
did not, and each is now either true or gone:

| Claim on the page | What the app does | Now |
| --- | --- | --- |
| The hero's "Live score" climbing 78 → 88 | No single live score exists on the interview screen | The header's real "Question n of ~6" |
| A rail headed "This round scores" with STAR bars | The rail is "Live coaching": Confidence, Relevance, Speaking pace, Conciseness, and notes | The real rail, with values from its own formulas |
| "Type your answer, or hold to speak" with a microphone | Text and voice are separate screens; voice is tap, and the microphone opens by itself | The text composer: "Your answer…" and Send |
| "We improved things" flagged as "Vague on impact" | The detector flags nothing in that sentence, and "Vague on impact" appears nowhere in the app | An answer the detector does flag, followed through the app |
| "Six kinds of round" and "2 practice modes", typed | Counts must be derived (`DESIGN.md`, "Honest copy") | `ROUND_TYPES.length` and the new `PRACTICE_MODES` |
| "Setup takes a minute" | Never measured | "You describe the role." |
| "A different interviewer in each" round of a loop | Optional: a round without one inherits the session's | "…its own interviewer if you like" |
| Per-answer STAR bars under "Honest scoring" | No screen shows STAR bars for one answer | The report's dimension profile, and the note under one answer |
| Report scores "on structure, specificity and confidence" | The report scores the round's rubric: STAR parts, specificity, clarity; or the technical areas | "A score for each rubric part…" |
| "You predicted 70. Solid: meets the rubric…" | That sentence is the analyzer's internal band; the report says "You predicted 70% — close to how it went." | The report's own sentence, from `predictionDetail` |
| A "Last six sessions" chart in the report | The report compares with the last session; trends are in Analytics | "+6 vs last session", and "in Analytics" on the bullet |
| A voice strip in the report: "1 pause over 3 s" | Long pauses start at 2.5 s (`LONG_PAUSE_SECONDS`), and delivery shows under each spoken answer and in Analytics, not in the report | Removed from the report mock; the bullet says where it is |
| "Tightened rewrite" | The report calls it "Your answer, tightened" | The report's label and hint |
| "The fastest way to learn how interviewers hear you" | Unmeasured | What the prediction actually shows: the gap between your read and the interviewer's |

The report mocks and the hero demo are now computed rather than typed: the
page runs the report's and the interview screen's own functions over example
readings, and three tests (`animated-demo`, `follow-up-scroll`,
`landing-copy`) fail if the page and the app drift apart.

**The rail's "Speaking pace" measured length.** It scored how close an answer's
word count came to 95, a target nothing explained. So it showed a pace for
typed answers, floored a tight 30-word answer at 38% (the same as a 160-word
one), and in a voice interview could read 38% beside the real "148 wpm" printed
under the answer. It now shows what it names: in a voice interview, words a
minute from the speech (the per-answer delivery snapshots the session already
saved, now exposed by the turn state, so it survives a reload); in a text
interview, "Answer length" in words, with no target. The hero demo, a text
interview, could then drop its answers from about 75 words to about 37.
`live-feedback-sidebar.test.ts` pins both modes.

**`FEATURES.md` described a different panel.** It said live coaching was text
only ("voice interviews never show it") and listed its measures as clarity,
specificity, confidence and structure. The voice screen opens the panel by
default, and the measures are Confidence, Relevance, Conciseness and the one
above. The document now describes the panel as it is.

**The landing header overflowed at tablet width.** Its five section links
appeared from 768px, where the row needs about 965px, so "Create account"
pushed the page wider than the screen. The links now appear from 1024px; below
that the header is the phone one.

**Sources:** none added.

---

## 2026-09-24

### What an error message tells a stranger

**Documents:** `SECURITY.md` (new), `README.md` (index row).

The error work below, written up as a security argument rather than a list of
edits: the three defects (messages that repeated whatever text they were
handed, authentication responses that distinguished one failure from another, a
redirect that followed any URL), each mapped to **OWASP Top 10:2025** with its
CWE, and a table separating what Supabase provides from what this project
provides — because most of what makes authentication here secure is not this
project's work.

The 2025 revision suits this work better than 2021 did. **A10:2025 Mishandling
of Exceptional Conditions** is new, carries CWE-209, and its Scenario #2 is this
defect exactly: errors triggered deliberately to harvest system detail for a
later attack. **A07:2025 Authentication Failures** states the enumeration
requirement in its own words — the same messages for all outcomes across
registration, credential recovery and API paths — which is the three flows
fixed here.

Two things recorded deliberately, against the temptation to round them up:

- **The sign-up claim is reasoned, not tested.** `GET /auth/v1/settings`
  returns `mailer_autoconfirm: false`, so email confirmation is enabled and the
  endpoint does not distinguish a taken address from a new one. An end-to-end
  test would have created a user that could not then be deleted, the
  service-role key being empty in `.env.local`. The document says so and gives
  the manual check instead.
- **Suppressing detail in responses moved it into logs.** A09:2025 maps
  CWE-532, sensitive information in a log file, so the document states what is
  written there and why the trade is judged worthwhile.

An earlier note in this session that email confirmation was *off* was an
assumption drawn from an unrelated probe, and is corrected by the settings
reading above.

**Sources:** the OWASP Top 10:2025 category pages for A01, A02, A07, A09 and
A10, read from `owasp.org` on 2026-09-24 and linked individually in
`SECURITY.md`. **This entry is an exception to the standing caveat at the head
of this file** — these references were checked online rather than compiled from
memory, and the quotations are the pages' own words.

---

## 2026-09-21

### Error messages: what the app wrote, or nothing

**Documents:** `DESIGN.md` (error rule under Patterns; three rules under Copy),
`DEPLOYMENT.md` (two troubleshooting rows).

Reported as "every error says Failed to fetch, even a wrong password". Forty-five
places printed a caught error's own `message`, so the browser's wording, a JSON
parser's complaint and the Supabase SDK's text all reached the screen. Supabase
*returns* a dropped connection as an error whose message is "Failed to fetch"
rather than throwing it, which is how the sign-in form came to say it. Checked
against the project: a wrong sign-in returns `400 invalid_credentials`, an
unreachable host returns `AuthRetryableFetchError`, status 0.

**Behaviour that reversed.**

- A screen shows a caught error only if the app authored it (`UserFacingError`,
  which `readJson` now throws as `ApiError`). Anything else becomes the
  caller's fallback. A dropped connection is matched on its message across
  Chrome, Safari, Firefox and Node, not on `instanceof TypeError`, which is
  also what a bug throws.
- Sign-in, sign-up and reset no longer print SDK text. A refused sign-in reads
  the same for every reason and says "credentials". A refused sign-up reads the
  same whether or not the address is taken. The reset link answers the same
  for an address with an account and one without, **including when Supabase
  rate-limits it**, because it only rate-limits addresses that exist.
- Responses stopped naming the system. The OpenAI configuration messages named
  the provider, `OPENAI_API_KEY`, Vercel, the model and the state of the
  account's billing; a schema error named `supabase/migrations`; every 500
  carried a Postgres error class. All of that is now an `operatorHint` that is
  always logged under the `ref` the user sees, and sent in the response only
  when `NODE_ENV` is not `production`. This reverses the decision in commit
  `2b9468b` (2026-09-11) to show those messages to everyone; the reason for
  that decision (a deployer who cannot tell why the first turn failed) is met
  by the log line instead.
- `readJson` no longer shows "Request failed (HTTP 502)" for a non-JSON body,
  and a 401 reads "Your session has expired. Sign in again."
- `redirectTo` on the sign-in page is followed only when it is a path on this
  site. It came from the URL and went straight to `router.replace`, so a link
  could send someone to another origin after a real sign-in.

**Where the wording alone is not enough.** Sign-up is only non-revealing while
email confirmation is enabled in Supabase; with it switched off,
`POST /auth/v1/signup` answers "User already registered" to anyone who calls it
directly, whatever the form says. It **is** enabled on this project —
`GET /auth/v1/settings` returns `mailer_autoconfirm: false` — which an earlier
draft of this entry had backwards, having assumed it rather than read it.

**Tests:** `user-facing-error.test.ts`, `auth-error-message.test.ts`,
`safe-redirect.test.ts` (new); `errors.test.ts`, `openai-errors.test.ts`,
`fetch-json.test.ts` (updated to pin production responses carrying only
`error` and `ref`). 896 tests.

**Sources:** none added.

## 2026-09-19

### A second pass on phones, from screenshots of the real thing

**Documents:** `DESIGN.md` ("Phones" section extended).

Ten defects reported from a phone after the first pass, each traced to one
cause: the onboarding dialog's options could not wrap because a `Button` is
`nowrap`; a sort control with `ml-auto` sat alone on a third row; a company
filter was drawn with one company in it; the document input's two buttons
could not break; six round tabs wrapped into three rows; usage rows read as
bare numbers in two columns; the wizard's sticky action bar drifted up the
screen; a summary line in an inline span could not truncate; `CardAction`
squeezed a card title to ninety pixels; and menus opened flush with the screen
edge. All fixed at the primitive where one existed — `Card`, `DropdownMenu`,
`Select`, `DocumentInput` — so the next screen inherits the fix.

**Sources:** none added.

### Every screen made to work on a phone

**Documents:** `DESIGN.md` (Shell, Setup wizard, Live interview; "Phones" section
added).

**What was measured.** Every route rendered under mobile emulation at 360px
and 390px, with a probe reporting anything past the viewport or wider than the
scrolling `main`, plus full-page screenshots read one by one. Before: the
dashboard overflowed by 65px (an implicit grid column grown to a `truncate`
title's minimum width), three dialogs overrode the mobile width clamp, the
live-interview header wrapped a two-line title inside a fixed 64px bar, the
analytics trend chart drew its labels at 4px, the sessions list left titles
sixty pixels wide beside a status badge, the compare table and radar clipped,
and five pages — Drills, Personas, Job descriptions, Resumes, Tips & guides —
had no navigation on a phone at all. After: nothing overflows on any of the 16
screens at either width.

**What changed in the product.** `dvh` heights throughout; `grid-cols-1` on
every grid that relied on the implicit column (39 of them); `sm:` prefixes on
dialog widths; a compact live-interview header; the score in the meta line on
phone-width session rows; charts drawn at their container's width; a "More"
tab in the mobile bar carrying the remaining pages and the palette; and the
setup wizard's Continue and Back pinned above the bar on phones. The coaching
rail stays hidden below `xl` by decision, and the design document now says so.

**Sources:** none added.

## 2026-09-18

### The steering note was in the wrong place, and nothing said so

**Documents:** `DESIGN-DECISIONS.md` §17 (new), `TOKEN-COST.md`
("The stable / volatile / steering split" rewritten), `REQUIREMENTS.md` (F9
evidence), `INTERVIEWER.md` §7, `PERSONA-EVAL.md`.

**What changed in the product.** The private note carrying the strategy, the
focus and the difficulty target now goes after the transcript and the answer it
responds to, rather than in the system prompt ahead of them. Measured: on a topic
pivot the model opened the named subject 0 times in 10 under the old order and 10
times in 10 under the new one, with identical text. Under the old order a
51-per-cell run produced roughly 150 pivots and one follow-up that mentioned the
new subject.

**Reference corrections.** `TOKEN-COST.md` described two system messages in a
fixed order; there are three, and the third is placed for obedience rather than
for cost. The same document recorded the static instructions as 832 chars /
~208 tokens in one section while a later section, corrected earlier the same day,
gave ~466 — the stale figure is now replaced and labelled, so the contradiction
is not simply papered over.

**On caching.** The reorder is neutral-to-positive: the cacheable prefix becomes
the stable prompt plus an append-only transcript instead of being cut short each
turn by a block that changes each turn. This is reasoning from OpenAI's
documented prefix rule, **not** a measurement — `cached_tokens` on live traffic
is still unread, as `TOKEN-COST.md` has always said.

**Sources:** none added.

### The persona dials, measured and then made to resolve

**Documents:** `PERSONA-EVAL.md` (new), `INTERVIEWER.md` §5 and §7,
`REQUIREMENTS.md` (F5, F9, F27, N2), `DEMO.md`, `TOKEN-COST.md`, `README.md`.

**What was measured.** Each dial was swept 1-10 with the others held at 5, and
every consumer of it recorded. Four of the six resolved only four or five of
their ten steps: the interviewer's instructions were written as three or four
bands of prose, so strictness 8, 9 and 10 were one interviewer, and pushback's
two *extremes* — 1-2 and 9-10 — were each a single setting, because all of its
consumers happened to break in the middle of the scale.

**What changed in the product.** Every dial gained a directive a reader can
count, alongside the adjective it already had: an acceptance bar on the
analyzer's own 0-100 scale (strictness), an acknowledgement allowance in words
(warmth), a per-question word budget (pace), five challenge rungs plus a budget
of unsupported claims allowed to pass (pushback), and a follow-ups-before-moving
floor (probing depth, which until now reached the interviewer through no prompt
text at all). Five dials now resolve all ten steps; probing depth resolves nine,
because depths 6 and 7 select the same probe tier.

**Two faults found by running the harness rather than reading it:**

- The `--live` arm had never executed successfully. It requests a JSON response
  format that OpenAI rejects unless a message contains the word "json", so every
  judge call returned 400. `INTERVIEWER.md` §7 recorded the arm as "not run yet";
  this is why.
- `PIVOT_TOPIC` was being cancelled two lines below itself. The steering block
  told the model to change subject and then supplied a focus and a gap drawn
  from the subject it was leaving. Unpredictability moved a blind judge's
  topic-shift rating by 0.0 points; pushback, whose move is a twist *within* the
  topic and so contradicts nothing, moved it by 2.2. The block now suppresses
  the focus and gap lines on a pivot.

**Corrections to numbers already published.**

- `TOKEN-COST.md` said the interviewer's stable prefix was ~590 tokens and
  therefore **never cached**. Re-measured, it is ~1,172 and sits **above** the
  1,024-token floor. Two causes, one of them deliberate: the persona description
  roughly doubled (~325 → ~656 tokens) as the directives were added, and the
  static instructions had already grown from 208 to ~466 through earlier edits
  that were never re-measured. The document now records characters as well as
  tokens so the figure can be re-derived rather than trusted.
- `DEMO.md` listed "the dials are coarse" as a caveat to raise, citing strictness
  5, 6 and 7 as byte-identical. That is no longer true and the passage was
  rewritten. The difficulty target is still compressed (1→10 moves it 5→7) and
  that part stands.
- `INTERVIEWER.md` §5 claimed "no two dials share a lever". Pushback and
  `questioningStyle` do interact: the twist threshold is `pushback - 5 +
  styleBias`, so it falls at 2 under `stress` and 8 under `supportive`. Stated
  rather than removed.

**Sources:** none added. The existing citations for the dial set — arXiv
2608.10412 for the 4.9% probe baseline, Amazon's Bar Raiser and "Dive Deep",
HackerRank's archetypes, SHRM — are unchanged and still support the same
choices; nothing in this work rests on a new reference.

## 2026-09-17

### Pauses: reported, never scored, and the thresholds that moved

**Documents:** `DESIGN-DECISIONS.md` §15 (new), `DESIGN.md`, `FEATURES.md`,
`DRILLS.md`, `UAT.md` (V5 rewritten).

**What changed in the product.** A counted pause moved from 1.5 s to 2.5 s, and
the silence that ends a turn moved from 3 s to 4 s. Nothing moved in the
scoring, because delivery never reached it: this was confirmed by reading
`response-analyzer.ts`, the chat route and `decision-engine.ts` rather than
assumed. The readouts are renamed from "Long pauses" to "Pauses to think" and
say that thinking time is not scored.

**Sources added** (all new to the repository):

- Goldman-Eisler, F. (1968). _Psycholinguistics: Experiments in Spontaneous
  Speech._ Academic Press.
- Rowe, M. B. (1986). Wait time: slowing down may be a way of speeding up.
  _Journal of Teacher Education_, 37(1), 43–50.
- Jefferson, G. (1989). Preliminary notes on a possible metric which provides
  for a "standard maximum" silence of approximately one second in conversation.
  In D. Roger & P. Bull (Eds.), _Conversation: An Interdisciplinary
  Perspective._ Multilingual Matters.
- Brennan, S. E., & Williams, M. (1995). The feeling of another's knowing.
  _Journal of Memory and Language_, 34(3), 383–398.
- DeGroot, T., & Motowidlo, S. J. (1999). Why visual and vocal interview cues
  can affect interviewers' judgments and predict job performance. _Journal of
  Applied Psychology_, 84(6), 986–993.

The last two are cited **against** the simple reading of the first two: they are
the evidence that listeners do read long silences as uncertainty, which is why
the count is still shown rather than deleted.

### A voice interview prints nothing to read from

**Documents:** `DESIGN-DECISIONS.md` §16 (new), `DESIGN.md`, `FEATURES.md`,
`UAT.md` (V5b, V5c added).

**What changed in the product.** The interviewer's questions are no longer
printed by default in a voice interview. One header button shows them, the
bubble offers the same, and the text appears by itself when playback fails or
when the interviewer's voice is switched off.

**Sources added** (all new to the repository):

- Mayer, R. E. (2009). _Multimedia Learning_ (2nd ed.). Cambridge University
  Press — the redundancy principle.
- Kalyuga, S., Chandler, P., & Sweller, J. (1999). Managing split-attention and
  redundancy in multimedia instruction. _Applied Cognitive Psychology_, 13(4),
  351–371.
- W3C. _Web Content Accessibility Guidelines (WCAG) 2.2_, §1.2.4 Captions
  (Live), Level AA — cited as the reason the transcript is switchable rather
  than removed.

### Token usage shown to the user

**Documents:** `FEATURES.md`, `REQUIREMENTS.md` (F28 added; N3 and N6 reworded),
`TOKEN-COST.md` ("What the user sees" added), `DESIGN.md`, `DEMO.md`
("Who can see what"), `UAT.md` (A7 added).

**What changed in the product.** Recorded token usage, which only a developer
command could read, is now shown to the user: a Usage section in Settings, a
line on each report, and an explainer in Tips & guides. Cost is priced on the
server and only the total is sent.

**Reference correction.** `DEMO.md` previously stated that a user "cannot see
what it cost". That is no longer true and the passage was rewritten. The
enforced boundary it described — the rate card never reaching the browser — is
unchanged, and the lint rule that enforces it now names its one carve-out for
route handlers.
