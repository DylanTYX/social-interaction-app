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
