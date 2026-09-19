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
