/**
 * Generates docs/presentation/FYP-demo.pptx
 *
 *   npm i pptxgenjs@4          # not a project dependency — install it wherever
 *   node docs/presentation/build-deck.mjs
 *
 * pptxgenjs 4.0.1 ships an ESM build without "type": "module" in its own
 * package.json, so `import pptxgen from "pptxgenjs"` fails under Node. The CJS
 * entry is fine, hence createRequire.
 *
 * Every figure in this deck is sourced. See docs/presentation/SCRIPT.md for the
 * claim -> file/command mapping. Do not add a number here that you have not run.
 */
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const pptxgen = require("pptxgenjs");

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "FYP-demo.pptx");

/* ------------------------------------------------------------------ theme */

const INK = "14161A";
const BODY = "3F4750";
const MUTED = "7A8593";
const ACCENT = "1D4ED8";
const ACCENT_SOFT = "EAF0FE";
const AMBER = "9A5B08";
const AMBER_SOFT = "FDF4E7";
const GREEN = "15803D";
const GREEN_SOFT = "EAF5EE";
const PANEL = "F5F7FA";
const LINE = "DFE4EA";
const WHITE = "FFFFFF";

const SANS = "Arial";
const MONO = "Courier New"; // guaranteed present on Windows + macOS; alignment matters here

const W = 13.333;
const H = 7.5;
const M = 0.62; // side margin
const CW = W - M * 2; // content width

const pptx = new pptxgen();
pptx.defineLayout({ name: "W16x9", width: W, height: H });
pptx.layout = "W16x9";
pptx.author = "Dylan Tan";
pptx.company = "ConvoTrainer";
pptx.title = "ConvoTrainer — FYP Demo";

/* ----------------------------------------------------------------- script
   Single source of truth for the spoken talk. These strings become the
   speaker notes, and docs/presentation/SCRIPT.md carries the same words.
   Sentences marked [cut if behind] bring the talk from ~5:20 to ~4:50.
   ========================================================================= */

const TALK = {
  s1: `[0:00]  ~72 words

Good morning. My final year project is ConvoTrainer, an interview practice
application. The important word on this slide is "steer". Most tools score you
at the end of a mock interview. This one scores every answer before it asks
the next question, and uses that score to decide what to ask.

Five minutes on the problem, the architecture, the part I can prove, and what
isn't finished — then I'll demo it.

FILL IN before presenting: your supervisor's name and the date.`,

  s2: `[0:29]  ~68 words

There are three ways to practise today. A question bank never notices that you
dodged the question. A human adapts perfectly, but isn't available at eleven
at night. A general chatbot will role-play, but won't grade you against a
rubric or push back when you're weak.

All three have the same hole: nothing connects how you answered to what you
get asked next. That loop is the project.

SHORT VERSION: "Question banks don't adapt, humans don't scale, chatbots don't score. Nothing closes the loop between your answer and the next question."`,

  s3: `[0:56]  ~68 words

The product is four setup steps, a round, and a report. You describe the role,
optionally attaching the real job description and your CV — both are used to
ground the questions.

Six round types, each with its own rubric: a system design answer isn't judged
the way a behavioural one is. Text or voice, with a code editor on technical
rounds. You'll see it in the demo.

SHORT VERSION: "Four setup steps, six round types each with its own rubric, text or voice, and a scored report. You'll see it in the demo."`,

  s4: `[1:23]  ~109 words  ★

This is the centre of the project — one turn, left to right.

Your answer arrives at the chat endpoint. Before anything is generated, a
second model call scores it against that round's rubric.

That verdict goes into a decision engine — ordinary deterministic code. It
picks one of seven questioning strategies and computes a difficulty target.
That becomes a private steering block inside the interviewer's prompt, which
the candidate never sees. Then the next question streams back.

Scoring is bounded at four seconds, so a slow analyzer can't hold the reply
hostage. And both messages and the analysis commit in one Postgres
transaction, so a turn can't half-exist.

KEY SLIDE — do not cut.`,

  s5: `[2:07]  ~124 words  ★

If you take one thing from this talk, take this slide.

The persona reaches the model two ways. Textually, each dial becomes a
sentence in the prompt — and prompt text has no effect you can compute, so you
have to measure what comes back.

The numeric path is arithmetic: strictness minus warmth, over four, clamped
one to ten. That number is injected as an explicit instruction — aim for
difficulty seven out of ten.

So: identical question, identical answer, identical round type. The only
variable is who's asking. The strict persona targets seven; the warm one
targets five. That isn't a sample from a stochastic model, it's a computation
— you can do the arithmetic by hand and get the same two numbers.

One limit, before you ask: scoring deliberately ignores persona. Grading
shouldn't depend on who asked.  [cut if behind]

KEY SLIDE — your strongest evidence. Slow down here.`,

  s6: `[2:56]  ~141 words  ★

Second — I don't estimate what this costs. I measure it.

Every OpenAI call records its token usage into a Postgres table as it happens.
A command-line tool reads that table and prices it, so any cost claim I make
is a query you can re-run.

The most useful result was a negative one. OpenAI only caches a prompt prefix
once it reaches 1,024 tokens. I'd structured the prompt in two layers — stable
first, volatile last — specifically so caching could engage. Then I measured
it: on a bare session the stable part is about 590 tokens. Under the floor. It
never fires.

I kept the structure; it costs nothing, and it's what makes caching possible
once a job description is attached.  [cut if behind] The tool reports that in
words, rather than printing a zero I could quietly reinterpret. The claim
isn't that this is cheap — it's that every call is instrumented and checkable,
including the optimisation that doesn't work.

KEY SLIDE. The negative result is the point — don't rush past it.`,

  s7: `[3:53]  ~100 words

Where it honestly stands, in three columns.

Built and verified: 299 unit tests across 31 files, all passing in CI
alongside typecheck and lint. Ten migrations with row-level security on every
table. Six round types in text and voice, and grounding through pgvector
inside Postgres, so retrieval inherits the same access rules as everything
else.  [cut if behind]

Built but not yet measured — and I'll be direct. I wrote an evaluation harness
for scoring accuracy, with eighteen hand-authored fixtures and defined
metrics. The results aren't collected yet. Same for user acceptance testing:
the plan is written, no participants yet.

The rule throughout has been: never claim a number I haven't run. That's why
the middle column is on the slide rather than left off it.

SHORT VERSION: "299 tests passing in CI, RLS everywhere, voice and text working. The eval harness and the UAT plan are written but not yet run — I'm not going to show you results I don't have."`,

  s8: `[4:33]  ~56 words

Three things, ordered by how much can go wrong. First the deterministic
persona proof, which can't fail — it makes no network calls. Then the cost
report, which reads the database. Then a live interview.

If a live part fails, I'll switch to the committed output and say so, rather
than watching a spinner with you.

Stop talking. Start demoing.`,
};

/* ---------------------------------------------------------------- helpers */

let pageNo = 0;

function chrome(slide, { footer = true } = {}) {
  if (!footer) return;
  pageNo += 1;
  slide.addText("ConvoTrainer  ·  Final Year Project", {
    x: M, y: H - 0.52, w: 6, h: 0.3,
    fontFace: SANS, fontSize: 10, color: MUTED, valign: "middle",
  });
  slide.addText(String(pageNo), {
    x: W - M - 1, y: H - 0.52, w: 1, h: 0.3,
    fontFace: SANS, fontSize: 10, color: MUTED, align: "right", valign: "middle",
  });
}

function head(slide, kicker, title, { accent = ACCENT } = {}) {
  slide.addShape(pptx.ShapeType.rect, {
    x: M, y: 0.46, w: 0.14, h: 0.14, fill: { color: accent },
  });
  slide.addText(kicker.toUpperCase(), {
    x: M + 0.26, y: 0.4, w: CW - 0.26, h: 0.26,
    fontFace: SANS, fontSize: 11, bold: true, color: accent, charSpacing: 1.6, valign: "middle",
  });
  slide.addText(title, {
    x: M, y: 0.76, w: CW, h: 0.62,
    fontFace: SANS, fontSize: 30, bold: true, color: INK, valign: "middle",
  });
}

/** A soft panel with an optional coloured left edge. */
function panel(slide, { x, y, w, h, fill = PANEL, edge = null }) {
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w, h, fill: { color: fill }, line: { color: fill, width: 0 },
  });
  if (edge) {
    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: 0.055, h, fill: { color: edge }, line: { width: 0 },
    });
  }
}

/** Monospace block, for real command output. */
function mono(slide, text, { x, y, w, h, size = 11, color = INK, fill = "111418", fg = null }) {
  slide.addShape(pptx.ShapeType.rect, {
    x, y, w, h, fill: { color: fill }, line: { width: 0 },
  });
  slide.addText(text, {
    x: x + 0.18, y: y + 0.12, w: w - 0.36, h: h - 0.24,
    fontFace: MONO, fontSize: size, color: fg || color,
    valign: "top", lineSpacing: size * 1.34,
  });
}

/** Horizontal step boxes with ▸ separators. */
function steps(slide, items, { y, h, boxFill = WHITE, boxLine = LINE, titleColor = INK }) {
  const n = items.length;
  const gap = 0.3;
  const bw = (CW - gap * (n - 1)) / n;
  items.forEach((it, i) => {
    const x = M + i * (bw + gap);
    slide.addShape(pptx.ShapeType.rect, {
      x, y, w: bw, h, fill: { color: boxFill }, line: { color: boxLine, width: 1 },
    });
    slide.addText(it.tag, {
      x: x + 0.16, y: y + 0.13, w: bw - 0.32, h: 0.24,
      fontFace: SANS, fontSize: 9.5, bold: true, color: ACCENT, charSpacing: 1.2, valign: "middle",
    });
    slide.addText(it.title, {
      x: x + 0.16, y: y + 0.38, w: bw - 0.32, h: 0.34,
      fontFace: SANS, fontSize: 14, bold: true, color: titleColor, valign: "middle",
    });
    slide.addText(it.body, {
      x: x + 0.16, y: y + 0.74, w: bw - 0.32, h: h - 0.9,
      fontFace: SANS, fontSize: 11, color: BODY, valign: "top", lineSpacing: 15,
    });
    if (i < n - 1) {
      slide.addText("▸", {
        x: x + bw, y: y + h / 2 - 0.16, w: gap, h: 0.32,
        fontFace: SANS, fontSize: 15, color: MUTED, align: "center", valign: "middle",
      });
    }
  });
}

/** Bulleted list where each line is "lead — rest"; lead is bolded. */
function leadList(slide, rows, { x, y, w, h, size = 12.5, gapLine = 1.5 }) {
  const runs = [];
  rows.forEach((r, i) => {
    runs.push({ text: "· ", options: { color: MUTED, bold: true } });
    runs.push({ text: r.lead, options: { bold: true, color: INK } });
    if (r.rest) runs.push({ text: "  " + r.rest, options: { color: BODY } });
    runs.push({ text: "", options: { breakLine: true } });
    if (i < rows.length - 1) runs.push({ text: "", options: { breakLine: true, fontSize: size * 0.35 } });
  });
  slide.addText(runs, {
    x, y, w, h, fontFace: SANS, fontSize: size, valign: "top", lineSpacing: size * gapLine,
  });
}

/* =================================================================== SLIDE 1
   Title
   ========================================================================= */
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };

  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: H, fill: { color: ACCENT } });

  s.addText("FINAL YEAR PROJECT  ·  DEMONSTRATION", {
    x: 1.05, y: 1.62, w: 10, h: 0.3,
    fontFace: SANS, fontSize: 12, bold: true, color: ACCENT, charSpacing: 2.2, valign: "middle",
  });

  s.addText("ConvoTrainer", {
    x: 1.0, y: 2.02, w: 11, h: 1.0,
    fontFace: SANS, fontSize: 56, bold: true, color: INK, valign: "middle",
  });

  s.addText(
    "An AI interview partner that scores every answer — and lets that score steer the next question.",
    {
      x: 1.05, y: 3.08, w: 10.2, h: 0.72,
      fontFace: SANS, fontSize: 19, color: BODY, valign: "top", lineSpacing: 27,
    },
  );

  s.addShape(pptx.ShapeType.rect, { x: 1.05, y: 4.06, w: 1.5, h: 0.035, fill: { color: ACCENT } });

  s.addText(
    [
      { text: "Dylan Tan", options: { bold: true, color: INK } },
      { text: " | Supervisor: «name» | «date»", options: { color: MUTED } },
    ],
    { x: 1.05, y: 4.32, w: 10, h: 0.3, fontFace: SANS, fontSize: 13, valign: "middle" },
  );

  panel(s, { x: 1.05, y: 5.15, w: 10.6, h: 0.66, fill: PANEL });
  s.addText(
    "Next.js 16 · React 19 · TypeScript · Supabase (Postgres + pgvector + RLS) · OpenAI · Azure Speech",
    {
      x: 1.25, y: 5.15, w: 10.2, h: 0.66,
      fontFace: SANS, fontSize: 12, color: BODY, valign: "middle",
    },
  );

  s.addNotes(TALK.s1);
  chrome(s, { footer: false });
}

/* =================================================================== SLIDE 2
   Problem
   ========================================================================= */
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  head(s, "The problem", "Interview practice has three options. All three have the same hole.");

  const cards = [
    {
      tag: "OPTION 1",
      title: "A static question bank",
      body: "Asks the same question in the same order no matter what you said. Never notices that you dodged the question.",
    },
    {
      tag: "OPTION 2",
      title: "A human mock interviewer",
      body: "Adapts perfectly. Is not available at 11pm the night before, and cannot be repeated ten times.",
    },
    {
      tag: "OPTION 3",
      title: "A general-purpose chatbot",
      body: "Will happily role-play. Does not grade you against a rubric, and does not change tack when an answer is weak.",
    },
  ];
  steps(s, cards, { y: 1.86, h: 2.05 });

  panel(s, { x: M, y: 4.28, w: CW, h: 1.34, fill: ACCENT_SOFT, edge: ACCENT });
  s.addText("The gap", {
    x: M + 0.34, y: 4.46, w: CW - 0.6, h: 0.3,
    fontFace: SANS, fontSize: 12, bold: true, color: ACCENT, charSpacing: 1.4, valign: "middle",
  });
  s.addText(
    "Nothing closes the loop between how you answered and what you get asked next. That loop is the project.",
    {
      x: M + 0.34, y: 4.76, w: CW - 0.7, h: 0.68,
      fontFace: SANS, fontSize: 17, bold: true, color: INK, valign: "top", lineSpacing: 24,
    },
  );

  s.addNotes(TALK.s2);
  chrome(s);
}

/* =================================================================== SLIDE 3
   What it is
   ========================================================================= */
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  head(s, "What it is", "Configure an interviewer, run a round, get scored.");

  steps(s, [
    { tag: "STEP 1", title: "Context", body: "Role, seniority, job description, CV" },
    { tag: "STEP 2", title: "Rounds", body: "One round, or a full multi-round loop" },
    { tag: "STEP 3", title: "Interviewer", body: "Persona + four behavioural dials" },
    { tag: "STEP 4", title: "Review", body: "Confirm and launch" },
  ], { y: 1.8, h: 1.28 });

  const colW = (CW - 0.34 * 2) / 3;

  const cols = [
    {
      h: "Six round types",
      edge: ACCENT,
      rows: [
        "Intro screening · 15 min",
        "Behavioural · 20 min",
        "HR / people · 20 min",
        "Technical SWE · 25 min",
        "Case · 25 min",
        "System design · 30 min",
      ],
      foot: "Each has its own rubric and its own scoring path.",
    },
    {
      h: "During the round",
      edge: ACCENT,
      rows: [
        "Streamed replies, text or voice",
        "Code editor on technical rounds",
        "Per-answer countdown timer",
        "Live coaching rail",
        "Resume after a disconnect",
      ],
      foot: "Voice is Azure STT + streaming TTS.",
    },
    {
      h: "After the round",
      edge: ACCENT,
      rows: [
        "Score breakdown per dimension",
        "Per-answer coaching + model answers",
        "Competency coverage (12)",
        "Calibration: guess before reveal",
        "Comparison against past sessions",
      ],
      foot: "Printable as a PDF.",
    },
  ];

  cols.forEach((c, i) => {
    const x = M + i * (colW + 0.34);
    panel(s, { x, y: 3.32, w: colW, h: 2.42, fill: PANEL, edge: c.edge });
    s.addText(c.h, {
      x: x + 0.28, y: 3.44, w: colW - 0.44, h: 0.3,
      fontFace: SANS, fontSize: 14, bold: true, color: INK, valign: "middle",
    });
    s.addText(c.rows.map((r) => ({ text: r, options: { breakLine: true } })), {
      x: x + 0.28, y: 3.78, w: colW - 0.44, h: 1.5,
      fontFace: SANS, fontSize: 11.5, color: BODY, valign: "top", lineSpacing: 17,
    });
    s.addText(c.foot, {
      x: x + 0.28, y: 5.3, w: colW - 0.44, h: 0.34,
      fontFace: SANS, fontSize: 10.5, italic: true, color: MUTED, valign: "top", lineSpacing: 14,
    });
  });

  s.addNotes(TALK.s3);
  chrome(s);
}

/* =================================================================== SLIDE 4
   The turn loop  ★
   ========================================================================= */
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  head(s, "Architecture · the core", "One turn: score first, then decide what to ask.");

  const boxes = [
    { t: "Your answer", b: "POST /api/chat", c: MUTED },
    { t: "Analyzer", b: "gpt-4o-mini · temp 0.1\nJSON rubric scores", c: ACCENT },
    { t: "Decision engine", b: "1 of 7 strategies\n+ difficulty N/10", c: ACCENT },
    { t: "Steering block", b: "private instruction\ninside the prompt", c: ACCENT },
    { t: "Next question", b: "streamed back", c: MUTED },
  ];

  const gap = 0.3;
  const bw = (CW - gap * (boxes.length - 1)) / boxes.length;
  const by = 1.84;
  const bh = 1.5;

  boxes.forEach((b, i) => {
    const x = M + i * (bw + gap);
    const isCore = b.c === ACCENT;
    s.addShape(pptx.ShapeType.rect, {
      x, y: by, w: bw, h: bh,
      fill: { color: isCore ? ACCENT_SOFT : PANEL },
      line: { color: isCore ? ACCENT : LINE, width: isCore ? 1.25 : 1 },
    });
    s.addText(b.t, {
      x: x + 0.14, y: by + 0.2, w: bw - 0.28, h: 0.34,
      fontFace: SANS, fontSize: 13.5, bold: true, color: INK, align: "center", valign: "middle",
    });
    s.addText(b.b, {
      x: x + 0.1, y: by + 0.58, w: bw - 0.2, h: 0.78,
      fontFace: MONO, fontSize: 9.5, color: isCore ? ACCENT : MUTED,
      align: "center", valign: "top", lineSpacing: 13,
    });
    if (i < boxes.length - 1) {
      s.addText("▸", {
        x: x + bw, y: by + bh / 2 - 0.16, w: gap, h: 0.32,
        fontFace: SANS, fontSize: 16, bold: true, color: ACCENT, align: "center", valign: "middle",
      });
    }
  });

  // the two annotations
  const annW = (CW - 0.34) / 2;
  panel(s, { x: M, y: 3.58, w: annW, h: 1.06, fill: AMBER_SOFT, edge: AMBER });
  s.addText(
    [
      { text: "Bounded, not blocking.  ", options: { bold: true, color: AMBER } },
      { text: "Scoring gets 4 s (STEER_DEADLINE_MS). Past it the reply starts unsteered — the verdict is still collected and stored.", options: { color: BODY } },
    ],
    { x: M + 0.3, y: 3.7, w: annW - 0.5, h: 0.84, fontFace: SANS, fontSize: 11.5, valign: "top", lineSpacing: 16 },
  );

  panel(s, { x: M + annW + 0.34, y: 3.58, w: annW, h: 1.06, fill: GREEN_SOFT, edge: GREEN });
  s.addText(
    [
      { text: "One transaction.  ", options: { bold: true, color: GREEN } },
      { text: "append_interview_turn locks the session row and writes both messages, the analysis and the turn count atomically.", options: { color: BODY } },
    ],
    { x: M + annW + 0.64, y: 3.7, w: annW - 0.5, h: 0.84, fontFace: SANS, fontSize: 11.5, valign: "top", lineSpacing: 16 },
  );

  panel(s, { x: M, y: 4.92, w: CW, h: 0.86, fill: ACCENT_SOFT, edge: ACCENT });
  s.addText(
    "The score is not just reported at the end. It is an input to the next question.",
    {
      x: M + 0.34, y: 4.92, w: CW - 0.6, h: 0.86,
      fontFace: SANS, fontSize: 17, bold: true, color: INK, valign: "middle",
    },
  );

  s.addText(
    "src/app/api/chat/route.ts  ·  src/lib/response-analyzer.ts  ·  src/lib/decision-engine.ts  ·  migration 0005",
    { x: M, y: 5.9, w: CW, h: 0.28, fontFace: MONO, fontSize: 9.5, color: MUTED, valign: "middle" },
  );

  s.addNotes(TALK.s4);
  chrome(s);
}

/* =================================================================== SLIDE 5
   Contribution, proven  ★
   ========================================================================= */
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  head(s, "The claim I can prove", "The interviewer's persona changes the questioning — arithmetically.");

  const leftW = 6.1;
  const rightW = CW - leftW - 0.4;

  s.addText("A persona reaches the model down two paths.", {
    x: M, y: 1.78, w: leftW, h: 0.3,
    fontFace: SANS, fontSize: 13, bold: true, color: INK, valign: "middle",
  });

  panel(s, { x: M, y: 2.16, w: leftW, h: 0.92, fill: PANEL, edge: MUTED });
  s.addText(
    [
      { text: "Textual", options: { bold: true, color: INK } },
      { text: "  — each dial becomes a sentence in the system prompt. Provable only by measuring the output.", options: { color: BODY } },
    ],
    { x: M + 0.28, y: 2.26, w: leftW - 0.46, h: 0.72, fontFace: SANS, fontSize: 11.5, valign: "top", lineSpacing: 16 },
  );

  panel(s, { x: M, y: 3.16, w: leftW, h: 1.78, fill: ACCENT_SOFT, edge: ACCENT });
  s.addText(
    [
      { text: "Numeric", options: { bold: true, color: ACCENT } },
      { text: "  — the dials feed a formula whose result is injected as an explicit instruction:", options: { color: BODY } },
    ],
    { x: M + 0.28, y: 3.24, w: leftW - 0.46, h: 0.5, fontFace: SANS, fontSize: 11.5, valign: "top", lineSpacing: 16 },
  );
  s.addText(
    [
      { text: "difficulty = clamp 1..10 of", options: { breakLine: true } },
      { text: "  round( base + repetitionBoost + (strictness − warmth) / 4 )", options: {} },
    ],
    {
      x: M + 0.28, y: 3.76, w: leftW - 0.46, h: 0.5,
      fontFace: MONO, fontSize: 10.5, bold: true, color: INK, valign: "top", lineSpacing: 14,
    },
  );
  s.addText("→  “Aim for difficulty N/10”", {
    x: M + 0.28, y: 4.26, w: leftW - 0.46, h: 0.26,
    fontFace: MONO, fontSize: 11, color: ACCENT, valign: "middle",
  });
  s.addText("No model call. Reproduces exactly, offline, every run.", {
    x: M + 0.28, y: 4.5, w: leftW - 0.46, h: 0.26,
    fontFace: SANS, fontSize: 11, italic: true, color: BODY, valign: "middle",
  });

  // right: real committed output
  s.addText("npm run eval:persona", {
    x: M + leftW + 0.4, y: 1.78, w: rightW, h: 0.3,
    fontFace: MONO, fontSize: 12, bold: true, color: INK, valign: "middle",
  });

  mono(
    s,
    [
      "Held constant: same question, same answer,",
      "same round type. Only the persona differs.",
      "",
      "--- follow-up difficulty on the SAME answer ---",
      "  Yuki Tanaka            7/10",
      "    strictness 9 · warmth 4 · pushback 9",
      "  Isabella Rodriguez     5/10",
      "    strictness 6 · warmth 9 · pushback 4",
      "  difference             2 points",
    ].join("\n"),
    { x: M + leftW + 0.4, y: 2.16, w: rightW, h: 2.7, fill: "111418", fg: "E6EAF0", size: 11 },
  );

  panel(s, { x: M, y: 5.02, w: CW, h: 0.78, fill: ACCENT_SOFT, edge: ACCENT });
  s.addText(
    "Not a sample from a stochastic model — a computation. You can do the arithmetic by hand and get the same number.",
    {
      x: M + 0.34, y: 5.02, w: CW - 0.6, h: 0.78,
      fontFace: SANS, fontSize: 15.5, bold: true, color: INK, valign: "middle",
    },
  );

  s.addText(
    [
      { text: "Stated limits:  ", options: { bold: true, color: AMBER } },
      { text: "the dials are coarse — strictness 1→10 moves difficulty only 5→7, and 5/6/7 emit byte-identical prompts. Scoring is persona-blind by design: a strict interviewer and a warm one grade the same answer identically.", options: { color: BODY } },
    ],
    { x: M, y: 5.94, w: CW, h: 0.62, fontFace: SANS, fontSize: 10.5, valign: "top", lineSpacing: 14.5 },
  );

  s.addNotes(TALK.s5);
  chrome(s);
}

/* =================================================================== SLIDE 6
   Measured, not asserted  ★
   ========================================================================= */
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  head(s, "Engineering rigour", "Every model call is instrumented, so cost is a query — not a claim.");

  const chain = [
    "Every OpenAI call",
    "UsageCollector.record()",
    "one row in llm_usage",
    "npm run cost-report",
    "tokens · cache hits · $",
  ];
  const gap = 0.26;
  const bw = (CW - gap * (chain.length - 1)) / chain.length;
  chain.forEach((t, i) => {
    const x = M + i * (bw + gap);
    s.addShape(pptx.ShapeType.rect, {
      x, y: 1.8, w: bw, h: 0.66,
      fill: { color: i === chain.length - 1 ? ACCENT_SOFT : PANEL },
      line: { color: i === chain.length - 1 ? ACCENT : LINE, width: 1 },
    });
    s.addText(t, {
      x: x + 0.08, y: 1.8, w: bw - 0.16, h: 0.66,
      fontFace: MONO, fontSize: 9.5, color: i === chain.length - 1 ? ACCENT : BODY,
      align: "center", valign: "middle", lineSpacing: 12,
    });
    if (i < chain.length - 1) {
      s.addText("▸", {
        x: x + bw, y: 1.96, w: gap, h: 0.34,
        fontFace: SANS, fontSize: 14, color: MUTED, align: "center", valign: "middle",
      });
    }
  });

  panel(s, { x: M, y: 2.72, w: CW, h: 1.92, fill: AMBER_SOFT, edge: AMBER });
  s.addText("The most useful result is a negative one", {
    x: M + 0.34, y: 2.88, w: CW - 0.7, h: 0.32,
    fontFace: SANS, fontSize: 15, bold: true, color: AMBER, valign: "middle",
  });
  s.addText(
    [
      { text: "OpenAI caches a prompt prefix only when it reaches 1,024 tokens. I ordered the prompt into a stable layer and a volatile layer so caching ", options: { color: BODY } },
      { text: "can", options: { color: INK, bold: true, italic: true } },
      { text: " engage. On a bare session the stable prefix is about 590 tokens — under the floor — so it does not fire at all. The tool reports that in words rather than printing a zero for me to spin.", options: { color: BODY } },
    ],
    { x: M + 0.34, y: 3.24, w: CW - 0.7, h: 0.86, fontFace: SANS, fontSize: 12.5, valign: "top", lineSpacing: 18 },
  );
  s.addText(
    "Attach a job description and the prompt clears the floor — which is exactly when caching is worth having. Padding the prompt to reach it would cost more than the discount returns.",
    { x: M + 0.34, y: 4.1, w: CW - 0.7, h: 0.44, fontFace: SANS, fontSize: 11, italic: true, color: MUTED, valign: "top", lineSpacing: 15 },
  );

  const halfW = (CW - 0.34) / 2;
  panel(s, { x: M, y: 4.82, w: halfW, h: 1.0, fill: PANEL });
  s.addText(
    [
      { text: "Also cut, and measured:", options: { bold: true, color: INK, breakLine: true } },
      { text: "trivial answers skip analysis · six countable fields moved out of the model into plain code · coach answers cached in Postgres", options: { color: BODY } },
    ],
    { x: M + 0.28, y: 4.94, w: halfW - 0.5, h: 0.8, fontFace: SANS, fontSize: 11, valign: "top", lineSpacing: 15 },
  );

  panel(s, { x: M + halfW + 0.34, y: 4.82, w: halfW, h: 1.0, fill: ACCENT_SOFT, edge: ACCENT });
  s.addText(
    [
      { text: "The claim is not “this is cheap.”", options: { bold: true, color: ACCENT, breakLine: true } },
      { text: "It is that every call is instrumented, priced and checkable — including the optimisation that provably does not fire.", options: { color: INK } },
    ],
    { x: M + halfW + 0.62, y: 4.94, w: halfW - 0.5, h: 0.8, fontFace: SANS, fontSize: 11.5, valign: "top", lineSpacing: 16 },
  );

  s.addNotes(TALK.s6);
  chrome(s);
}

/* =================================================================== SLIDE 7
   Status and honest limits
   ========================================================================= */
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  head(s, "Where it stands", "Built, measured, and not yet — stated separately.");

  const colW = (CW - 0.34 * 2) / 3;
  const cols = [
    {
      mark: "✔",
      color: GREEN,
      soft: GREEN_SOFT,
      h: "Built and verified",
      rows: [
        "299 tests across 31 files, all passing",
        "CI: typecheck + lint + test on every push",
        "10 migrations; RLS on every table",
        "Six round types, text and voice",
        "Multi-round loops with handover",
        "JD + CV grounding via pgvector",
      ],
    },
    {
      mark: "◑",
      color: AMBER,
      soft: AMBER_SOFT,
      h: "Built, not yet measured",
      rows: [
        "Scoring-accuracy eval — harness and 18 fixtures written, results not yet collected",
        "UAT — plan, handout and exit criteria written, no participants run yet",
        "The blind-judge arm of the persona eval has not been run live",
      ],
    },
    {
      mark: "✖",
      color: MUTED,
      soft: PANEL,
      h: "Out of scope, on purpose",
      rows: [
        "Code is reviewed, never executed",
        "English only",
        "No CSP yet — pending an audit of the speech websocket origins",
        "Rate limiter is in-process, so not correct across serverless instances",
      ],
    },
  ];

  cols.forEach((c, i) => {
    const x = M + i * (colW + 0.34);
    panel(s, { x, y: 1.8, w: colW, h: 3.4, fill: c.soft, edge: c.color });
    s.addText(`${c.mark}  ${c.h}`, {
      x: x + 0.28, y: 1.94, w: colW - 0.46, h: 0.32,
      fontFace: SANS, fontSize: 13.5, bold: true, color: c.color, valign: "middle",
    });
    const runs = [];
    c.rows.forEach((r, j) => {
      runs.push({ text: r, options: { breakLine: true } });
      if (j < c.rows.length - 1) runs.push({ text: "", options: { breakLine: true, fontSize: 5 } });
    });
    s.addText(runs, {
      x: x + 0.28, y: 2.34, w: colW - 0.46, h: 2.76,
      fontFace: SANS, fontSize: 11, color: BODY, valign: "top", lineSpacing: 15,
    });
  });

  panel(s, { x: M, y: 5.42, w: CW, h: 0.82, fill: ACCENT_SOFT, edge: ACCENT });
  s.addText(
    [
      { text: "The rule I held to:  ", options: { bold: true, color: ACCENT } },
      { text: "never claim a number I have not run. Everything on the left is a command you can execute; everything in the middle is a command I have not executed yet.", options: { color: INK } },
    ],
    { x: M + 0.34, y: 5.42, w: CW - 0.6, h: 0.82, fontFace: SANS, fontSize: 13, valign: "middle", lineSpacing: 18 },
  );

  s.addNotes(TALK.s7);
  chrome(s);
}

/* =================================================================== SLIDE 8
   Demo transition
   ========================================================================= */
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  head(s, "Demonstration", "Three things, in increasing order of what can go wrong.");

  const rows = [
    {
      n: "01",
      t: "Personas actually differ",
      cmd: "npm run eval:persona",
      d: "Deterministic. No API calls, no network, byte-identical every run.",
      risk: "Cannot fail",
      riskColor: GREEN,
      riskSoft: GREEN_SOFT,
    },
    {
      n: "02",
      t: "What it has cost",
      cmd: "npm run cost-report",
      d: "Reads every recorded model call and prices it. Includes the caching counterfactual.",
      risk: "Needs the database",
      riskColor: AMBER,
      riskSoft: AMBER_SOFT,
    },
    {
      n: "03",
      t: "A live interview",
      cmd: "npm run dev",
      d: "Short round with the strict persona, so the pushback is visible. Then the report.",
      risk: "Live model calls",
      riskColor: AMBER,
      riskSoft: AMBER_SOFT,
    },
  ];

  rows.forEach((r, i) => {
    const y = 1.84 + i * 1.28;
    panel(s, { x: M, y, w: CW, h: 1.1, fill: PANEL, edge: ACCENT });
    s.addText(r.n, {
      x: M + 0.3, y, w: 0.7, h: 1.1,
      fontFace: SANS, fontSize: 24, bold: true, color: ACCENT, valign: "middle",
    });
    s.addText(r.t, {
      x: M + 1.05, y: y + 0.18, w: 4.2, h: 0.36,
      fontFace: SANS, fontSize: 15.5, bold: true, color: INK, valign: "middle",
    });
    s.addText(r.cmd, {
      x: M + 1.05, y: y + 0.56, w: 4.2, h: 0.32,
      fontFace: MONO, fontSize: 11.5, color: ACCENT, valign: "middle",
    });
    s.addText(r.d, {
      x: M + 5.45, y: y + 0.2, w: 4.6, h: 0.7,
      fontFace: SANS, fontSize: 11.5, color: BODY, valign: "middle", lineSpacing: 16,
    });
    s.addShape(pptx.ShapeType.rect, {
      x: M + 10.25, y: y + 0.36, w: 1.6, h: 0.38,
      fill: { color: r.riskSoft }, line: { color: r.riskColor, width: 1 },
    });
    s.addText(r.risk, {
      x: M + 10.25, y: y + 0.36, w: 1.6, h: 0.38,
      fontFace: SANS, fontSize: 9.5, bold: true, color: r.riskColor, align: "center", valign: "middle",
    });
  });

  s.addText(
    "If anything live fails I will switch to the committed output in docs/artifacts/ and say so.",
    { x: M, y: 5.82, w: CW, h: 0.36, fontFace: SANS, fontSize: 12, italic: true, color: MUTED, valign: "middle" },
  );

  s.addNotes(TALK.s8);
  chrome(s);
}

/* ================================================================ APPENDIX
   Not presented. There for questions.
   ========================================================================= */

function appendixDivider() {
  const s = pptx.addSlide();
  s.background = { color: INK };
  s.addText("Appendix", {
    x: M, y: 3.0, w: CW, h: 0.8,
    fontFace: SANS, fontSize: 40, bold: true, color: WHITE, valign: "middle",
  });
  s.addText("Not presented — held for questions.", {
    x: M, y: 3.86, w: CW, h: 0.4,
    fontFace: SANS, fontSize: 15, color: "9AA5B4", valign: "middle",
  });
  pageNo += 1;
}
appendixDivider();

/** Simple two-column appendix slide. */
function appendix(kicker, title, blocks, notes) {
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  head(s, kicker, title);
  const n = blocks.length;
  const colW = n === 1 ? CW : (CW - 0.34 * (n - 1)) / n;
  blocks.forEach((b, i) => {
    const x = M + i * (colW + 0.34);
    panel(s, { x, y: 1.78, w: colW, h: 4.0, fill: b.soft || PANEL, edge: b.edge || ACCENT });
    s.addText(b.h, {
      x: x + 0.3, y: 1.92, w: colW - 0.5, h: 0.34,
      fontFace: SANS, fontSize: 14, bold: true, color: b.edge || INK, valign: "middle",
    });
    const runs = [];
    b.rows.forEach((r, j) => {
      if (typeof r === "string") {
        runs.push({ text: r, options: { breakLine: true, color: BODY } });
      } else {
        runs.push({ text: r.lead, options: { bold: true, color: INK } });
        runs.push({ text: "  " + r.rest, options: { color: BODY, breakLine: true } });
      }
      if (j < b.rows.length - 1) runs.push({ text: "", options: { breakLine: true, fontSize: 5 } });
    });
    s.addText(runs, {
      x: x + 0.3, y: 2.34, w: colW - 0.5, h: 3.34,
      fontFace: SANS, fontSize: 11.5, valign: "top", lineSpacing: 16,
    });
  });
  if (notes) s.addNotes(notes);
  chrome(s);
  return s;
}

appendix(
  "Appendix A",
  "Full architecture",
  [
    {
      h: "Layers",
      rows: [
        { lead: "Proxy", rest: "refreshes the Supabase session cookie on every request" },
        { lead: "Pages", rest: "marketing, auth, dashboard, and the two interview surfaces" },
        { lead: "API", rest: "18 route files — auth-gated, rate-limited, RLS-backed" },
        { lead: "Domain", rest: "pure, unit-tested logic: analyzer, decision engine, rounds, competencies, summary" },
        { lead: "Data", rest: "src/lib/db — the only place SQL shapes live" },
        { lead: "Operator", rest: "src/eval — CLI only, never bundled" },
      ],
    },
    {
      h: "Why it is shaped this way",
      rows: [
        { lead: "Domain logic is pure", rest: "so it can be tested without a network or a database. That is why there are 299 tests and no mocking framework." },
        { lead: "One model for every interviewer turn", rest: "a different model is a different cache, so mixing them means never reusing a prefix." },
        { lead: "Retrieval lives inside Postgres", rest: "pgvector rather than an external vector DB, so retrieval inherits the same row-level security as everything else." },
        { lead: "No global state library", rest: "hook-owned state with a single owner per concern." },
      ],
    },
  ],
  "Use this if asked to expand on slide 4. The point to land: domain logic is pure and therefore testable, and retrieval was kept in Postgres so it inherits RLS.",
);

appendix(
  "Appendix B",
  "Data, access control and grounding",
  [
    {
      h: "Storage",
      rows: [
        { lead: "10 migrations", rest: "sessions, messages, personas, job descriptions, resumes, usage, coach answers" },
        { lead: "RLS on every table", rest: "user_id = auth.uid(), enforced in the database, not the application" },
        { lead: "pgvector", rest: "job description chunks — 1,200 chars with 180 overlap, embedded with text-embedding-3-small" },
        { lead: "The retrieval RPC filters on auth.uid()", rest: "inside Postgres, so a bug in application code cannot leak another user's document" },
      ],
    },
    {
      h: "Grounding decisions",
      rows: [
        { lead: "Small job descriptions are not embedded", rest: "four chunks or fewer get inlined whole into the cacheable prefix — retrieval would cost more than it saves" },
        { lead: "The retrieval query is not the raw answer", rest: "it is the previous turn's nextFocus, so retrieval follows where the interview is going" },
        { lead: "A CV is distilled once at upload", rest: "into a compact profile, capped at 400 tokens, rather than re-read every turn" },
        { lead: "Speech keys never reach the browser", rest: "a server route mints a short-lived token" },
      ],
    },
  ],
  "For questions about the database, security, or RAG. Strongest line: retrieval is filtered by auth.uid() inside Postgres, so it is covered by the same rule as every other table.",
);

appendix(
  "Appendix C",
  "Why nationality is biography — and culture is not in the vector database",
  [
    {
      h: "What nationality does",
      soft: PANEL,
      rows: [
        "It is one adjective in one sentence of the persona's self-description, and it is read nowhere else in the codebase.",
        "The instruction immediately after it tells the model never to infer directness, formality, deference or expectations from it.",
        "A test asserts that two personas differing only in nationality produce prompts that differ by exactly the demonym.",
      ],
    },
    {
      h: "Why there is no culture corpus",
      soft: AMBER_SOFT,
      edge: AMBER,
      rows: [
        { lead: "It is national-origin stereotyping with extra steps.", rest: "A retrieval store keyed on nationality that returns behavioural claims makes the model generate behaviour from national origin, deterministically. That is what a stereotype is." },
        { lead: "It cannot be sourced at the granularity it needs.", rest: "Hofstede and GLOBE are national aggregates whose own authors warn against applying them to individuals — the ecological fallacy." },
        { lead: "It is not needed.", rest: "Strictness, warmth, pace and pushback are explicit and measurable. They make the claim falsifiable; nationality would make it arguable." },
      ],
    },
  ],
  "Expect this question. It is a design decision, not an omission.\n\nIf asked what you would do instead: interview CONVENTIONS by market — competency frameworks, self-introduction openers, whether case rounds are used — keyed off the job description and cited to hiring guides. About process, not people. Defensible and sourceable. Scoped out deliberately, not overlooked.",
);

appendix(
  "Appendix D",
  "Two design decisions worth defending",
  [
    {
      h: "Why scoring ignores the persona",
      rows: [
        "The analyzer takes no persona argument at all, and its cache key is keyed only on round type.",
        "A strict interviewer and a warm one score the same answer identically.",
        { lead: "Why:", rest: "grading should not depend on who asked. An answer is worth what it is worth. The persona controls what gets probed next and how hard — which is where interviewer variation belongs." },
        { lead: "Side benefit:", rest: "the analyzer's prompt prefix is then shared across all users, which is the one place caching has a real chance of firing." },
      ],
    },
    {
      h: "Why the question bank is not in the vector database",
      rows: [
        "Retrieval saves tokens when it replaces stuffing a large corpus into the prompt. That is exactly why it is used for job descriptions, which run to 30,000 characters.",
        "The interviewer prompt has no question corpus to slim down — questions are generated, not looked up.",
        { lead: "The whole 39-question bank is about 800 tokens.", rest: "Retrieval would add 60–150 input tokens per turn plus an embedding call. The corpus is smaller than the machinery needed to search it." },
        { lead: "Honest caveat:", rest: "there is a legitimate quality argument for a curated bank. There is no cost argument." },
      ],
    },
  ],
  "The two questions most likely to come back after slide 5 and slide 6.",
);

appendix(
  "Appendix E",
  "Testing, CI, and a lint rule used as an architectural boundary",
  [
    {
      h: "What is tested",
      soft: GREEN_SOFT,
      edge: GREEN,
      rows: [
        { lead: "299 tests, 31 files, all passing.", rest: "Pure logic plus route handlers — the route tests cover authentication, input bounds and the prompt trust boundary." },
        { lead: "No network in the test suite.", rest: "Domain logic was kept pure specifically so this would be possible." },
        { lead: "The speech queue test fakes the Azure SDK contract", rest: "so a regression that stops calling close() fails in CI the same way it failed in the browser." },
        { lead: "CI runs typecheck, lint and tests", rest: "on every push and pull request." },
      ],
    },
    {
      h: "The boundary that is actually enforced",
      soft: ACCENT_SOFT,
      edge: ACCENT,
      rows: [
        "The developer tooling — the eval harnesses, the cost report, the OpenAI rate card — must never be bundled into the browser.",
        { lead: "An ESLint rule forbids it.", rest: "Application code may not import the eval directory, the pricing table, or the test support helpers. A future mistake fails CI instead of silently shipping the price list to every user." },
        { lead: "The service-role key has no NEXT_PUBLIC_ prefix,", rest: "so it evaluates to undefined in a browser even if it were imported by accident." },
        { lead: "Stated plainly:", rest: "the absence of a user interface is not access control. The enforced boundaries are the import graph, the key naming, and RLS." },
      ],
    },
  ],
  "Good answer to 'how do you know it works?' and to any question about developer tooling being reachable by end users.\n\nThe honest exception: a logged-in user can read their OWN token-usage rows over the API, because usage is written using their own session. They cannot read anyone else's, cannot modify any, and cannot derive cost — the price table is not in the browser. Documented as a trade-off, with the proper fix being a service-role write path.",
);

appendix(
  "Appendix F",
  "What I would do next",
  [
    {
      h: "Immediately",
      rows: [
        { lead: "Run the scoring evaluation.", rest: "The harness, the fixtures and the metrics exist. It costs money to run, which is the only reason it has not been." },
        { lead: "Run the UAT.", rest: "Plan, tester handout and exit criteria are written; it needs at least two non-developer testers to complete a full interview unaided." },
        { lead: "Run the blind-judge arm of the persona evaluation", rest: "to measure the textual path, which cannot be proved by inspection." },
      ],
    },
    {
      h: "Then",
      rows: [
        { lead: "Move the rate limiter out of process", rest: "so it is correct across serverless instances." },
        { lead: "Add a content security policy", rest: "once the speech websocket origins are inventoried." },
        { lead: "Write usage rows with a service-role path", rest: "so the grant to authenticated users can be revoked." },
        { lead: "Interview conventions by market", rest: "— process, not people — as the defensible version of the cultural-context idea." },
        { lead: "Persist the delivery metrics", rest: "already computed during voice rounds into the report." },
      ],
    },
  ],
  "Have this ready for 'what's left?' — answering with a prioritised list, where the top item is 'run the measurement I already built', is much stronger than a feature wishlist.",
);

/* -------------------------------------------------------------------- ship */

await pptx.writeFile({ fileName: OUT });
console.log("wrote", OUT);
