/**
 * Generates docs/presentation/FYP-demo.pptx, and rewrites Section 1 of
 * docs/presentation/SCRIPT.md from the same SLIDES array so the deck's speaker
 * notes and the rehearsal script can never disagree.
 *
 *   npm i pptxgenjs@4 && node docs/presentation/build-deck.mjs
 *
 * pptxgenjs is deliberately NOT a dependency of this project — it has no place
 * in the app's bundle or its lockfile. Install it anywhere and point at it:
 *
 *   PPTXGENJS_PATH=/some/where/node_modules node docs/presentation/build-deck.mjs
 *
 * (NODE_PATH is not a reliable substitute; Node ignores it in several setups.)
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
import fs from "node:fs";

const pptxgen = (() => {
  const fromHere = createRequire(import.meta.url);
  try {
    return fromHere("pptxgenjs");
  } catch (err) {
    if (err.code !== "MODULE_NOT_FOUND") throw err;
    const dir = process.env.PPTXGENJS_PATH;
    if (!dir) {
      throw new Error(
        "pptxgenjs not found.\n" +
          "  Install it next to this script:  npm i pptxgenjs@4\n" +
          "  or point at an existing copy:    PPTXGENJS_PATH=/path/to/node_modules",
      );
    }
    // Accept either the node_modules directory itself or its parent: a require
    // rooted *inside* node_modules resolves upward from the wrong place.
    const root = path.basename(dir) === "node_modules" ? path.dirname(dir) : dir;
    return createRequire(path.join(root, "resolve-root.js"))("pptxgenjs");
  }
})();

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
   Single source of truth for the spoken talk.

   Running this file derives BOTH the speaker notes embedded in the .pptx AND
   Section 1 of SCRIPT.md from the array below, so the two cannot drift apart.
   Edit the talk here and nowhere else.
   ========================================================================= */

const WPM = 150;

const SLIDES = [
  {
    id: "s1",
    title: "What it is, and the gap",
    star: false,
    extra: "FILL IN before presenting: your supervisor's name and the date.",
    short: "Question banks don't adapt, humans don't scale, chatbots don't score. ConvoTrainer scores every answer and uses that score to pick the next question.",
    talk: `Good morning. My final year project is ConvoTrainer, an interview practice application.

All three ways of practising today have the same hole. A question bank asks the same things in the same order; it never notices that you dodged the question. A human adapts perfectly, but isn't available at eleven at night and can't be repeated ten times. A general chatbot will role-play, but won't grade you against a rubric or push back when you're weak. Nothing connects how you answered to what you get asked next. That loop is the project.

So: you describe the role, optionally attaching the real job description and your CV, which are used to ground the questions. You pick the rounds and shape the interviewer. Then you interview.

Six round types, each with its own rubric — a system design answer isn't judged the way a behavioural one is. Text or voice, with a code editor on technical rounds. Afterwards, a scored report with per-answer coaching, model answers and competency coverage.

The rest of the slides are how that works underneath.`,
  },
  {
    id: "s2",
    title: "How a turn works",
    star: true,
    extra: "KEY SLIDE — this is the architecture. Do not rush it.",
    short: null,
    talk: `This is the centre of the project — one turn, left to right.

Your answer arrives at the chat endpoint. Before anything is generated, a second model call scores it against the rubric for that round type, at low temperature, returning JSON.

That verdict goes into a decision engine — ordinary deterministic code, no model involved. It picks one of seven questioning strategies: probe the action, challenge ownership, drill for specificity. It also computes a difficulty target. Those become a private steering block inside the interviewer's prompt, which the candidate never sees. Then the next question streams back.

Why that order? A verdict that only arrives at the end of the interview cannot change the interview. Scoring before generating is what makes the questioning adaptive rather than scripted.

Three engineering points. Scoring is bounded at four seconds — I measured the turn before changing it, rather than guessing. Past that deadline the question starts unsteered, but the verdict is still collected and stored, so the transcript and the report are unaffected.

Both messages and the analysis commit in one Postgres transaction, so a turn can't half-exist.

And every interviewer turn runs on the same model. The opening turn used to use a stronger one — but a different model is a different prompt cache, so the session paid full price twice and hit cache neither time.`,
  },
  {
    id: "s3",
    title: "What I can prove",
    star: true,
    extra: "KEY SLIDE — your strongest evidence. Slow down here.",
    short: null,
    talk: `This is the claim I can prove, and the one I'd most like you to look at.

The persona reaches the model down two paths. Textually, each dial becomes a sentence in the system prompt — and prompt text has no effect you can compute, so you have to measure what comes back.

The numeric path is arithmetic: strictness minus warmth, over four, plus a repetition boost, clamped one to ten. That number is injected as an explicit instruction — aim for difficulty seven out of ten.

On the right is real output. Identical question, identical answer, identical round type. The only variable is who's asking. Yuki, at strictness nine and warmth four, targets seven. Isabella, at warmth nine and pushback four, targets five.

That isn't a sample from a stochastic model, it's a computation — you can do the arithmetic by hand and get the same two numbers, every run, offline. And a test fails if a future edit brings those two personas' dials together, so the comparison can't quietly stop demonstrating anything.

Two limits, before you ask. The dials are coarse: strictness one to ten moves difficulty only five to seven. And scoring deliberately ignores persona — grading shouldn't depend on who asked.`,
  },
  {
    id: "s4",
    title: "What it costs",
    star: true,
    extra: "KEY SLIDE — the negative result is the point, not a caveat.",
    short: null,
    talk: `Second — I don't estimate what this costs. I measure it.

Every OpenAI call records its token usage, including how much was served from cache, into a Postgres table as the call happens. A command-line tool reads that table and prices it, reporting tokens per call site, cache hit rate, and cost per turn. So any cost figure I give you is a query you can re-run.

The most useful result was a negative one. OpenAI only caches a prompt prefix once it reaches 1,024 tokens. I'd deliberately structured the prompt in two layers — stable part first, volatile part last — specifically so caching could engage. Then I measured it: on a bare session the stable prefix is about 590 tokens. Under the floor. It never fires.

I kept the structure, because it costs nothing and it's what makes caching possible once a job description is attached — which is when the prompt is big enough to matter. But the tool reports that it didn't fire, in words, rather than printing a zero I could quietly reinterpret.

That's the claim I want to make. Not that this is cheap — a ten-question round is roughly a cent. It's that every model call is instrumented, priced and checkable, including the optimisation that provably doesn't work.`,
  },
  {
    id: "s5",
    title: "Status, limits, and the demo",
    star: false,
    extra: "Stop talking. Start demoing.",
    short: "299 tests passing in CI, RLS everywhere, voice and text working. The eval harness and the UAT plan are written but not yet run — I'm not going to show you results I don't have.",
    talk: `Finally, where it honestly stands.

Built and verified: 299 unit tests across 31 files, all passing in CI on every push alongside typecheck and lint. Ten migrations with row-level security on every table — and retrieval runs through pgvector inside Postgres, so it inherits the same access rules as everything else.

Built but not yet measured, and I'll be direct. I wrote an evaluation harness for scoring accuracy, with eighteen hand-authored fixtures and defined metrics. The results aren't collected yet — not because the harness doesn't work, but because every run is billed, and I wanted the metrics and the fixture set settled first so the first run is the real one rather than a pilot. Same for user acceptance testing: the plan, the handout and the exit criteria are written; no participants have been through it.

Some things are deliberately out of scope — submitted code is reviewed, never executed, and it's English only.

The rule I held to throughout: never claim a number I haven't run. That's why the middle column is on this slide rather than left off it.

So, three things to show you, ordered by how much can go wrong. Starting with the one that can't fail.`,
  },
];

function wordCount(t) {
  return t.trim().split(/\s+/).length;
}

function clock(seconds) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Greedy wrap, preserving blank-line paragraph breaks. */
function wrap(text, width) {
  return text
    .trim()
    .split(/\n\s*\n/)
    .map((para) => {
      const lines = [];
      let line = "";
      for (const w of para.split(/\s+/)) {
        if (line && (line + " " + w).length > width) {
          lines.push(line);
          line = w;
        } else {
          line = line ? line + " " + w : w;
        }
      }
      if (line) lines.push(line);
      return lines.join("\n");
    })
    .join("\n\n");
}

let elapsed = 0;
for (const s of SLIDES) {
  s.words = wordCount(s.talk);
  s.at = clock(elapsed);
  elapsed += (s.words / WPM) * 60;
}
const TOTAL_WORDS = SLIDES.reduce((n, s) => n + s.words, 0);

/** Speaker note = timing header + the talk itself + delivery cues. */
const TALK = Object.fromEntries(
  SLIDES.map((s) => {
    const parts = [`[${s.at}]  ~${s.words} words${s.star ? "  \u2605" : ""}`, "", wrap(s.talk, 78)];
    if (s.extra) parts.push("", s.extra);
    if (s.short) parts.push("", `SHORT VERSION: "${s.short}"`);
    return [s.id, parts.join("\n")];
  }),
);

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
   What it is, and the gap  (title + problem + product, merged)
   ========================================================================= */
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };

  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.22, h: H, fill: { color: ACCENT } });

  s.addText("FINAL YEAR PROJECT  ·  DEMONSTRATION", {
    x: M + 0.24, y: 0.38, w: CW, h: 0.28,
    fontFace: SANS, fontSize: 11, bold: true, color: ACCENT, charSpacing: 2.0, valign: "middle",
  });

  s.addText("ConvoTrainer", {
    x: M + 0.2, y: 0.72, w: CW, h: 0.58,
    fontFace: SANS, fontSize: 38, bold: true, color: INK, valign: "middle",
  });

  s.addText(
    "An AI interview partner that scores every answer — and lets that score steer the next question.",
    {
      x: M + 0.24, y: 1.34, w: CW - 0.5, h: 0.36,
      fontFace: SANS, fontSize: 16, color: BODY, valign: "middle",
    },
  );

  s.addText(
    [
      { text: "Dylan Tan", options: { bold: true, color: INK } },
      { text: "   ·   Supervisor: «name»   ·   «date»", options: { color: MUTED } },
    ],
    { x: M + 0.24, y: 1.72, w: CW - 0.5, h: 0.26, fontFace: SANS, fontSize: 12, valign: "middle" },
  );

  // the gap, in one line — the speaker says the rest
  panel(s, { x: M, y: 2.2, w: CW, h: 0.74, fill: ACCENT_SOFT, edge: ACCENT });
  s.addText(
    [
      { text: "Question banks don't adapt. Humans don't scale. Chatbots don't score.   ", options: { color: BODY } },
      { text: "Nothing closes the loop between how you answered and what you get asked next.", options: { bold: true, color: INK } },
    ],
    {
      x: M + 0.34, y: 2.2, w: CW - 0.6, h: 0.74,
      fontFace: SANS, fontSize: 13.5, valign: "middle", lineSpacing: 19,
    },
  );

  steps(s, [
    { tag: "STEP 1", title: "Context", body: "Role, job description, CV" },
    { tag: "STEP 2", title: "Rounds", body: "One round, or a full loop" },
    { tag: "STEP 3", title: "Interviewer", body: "Persona + four dials" },
    { tag: "STEP 4", title: "Review", body: "Confirm and launch" },
  ], { y: 3.1, h: 1.02 });

  const factW = (CW - 0.34 * 2) / 3;
  const facts = [
    {
      h: "Six round types",
      rows: [
        "Screening · behavioural · HR",
        "Technical SWE · system design · case",
        "Each with its own rubric",
      ],
    },
    {
      h: "Text or voice",
      rows: [
        "Streamed replies, live coaching rail",
        "Code editor on technical rounds",
        "Azure speech-to-text and TTS",
      ],
    },
    {
      h: "A scored report",
      rows: [
        "Breakdown + per-answer coaching",
        "Model answers · competency coverage",
        "Calibration: guess before the reveal",
      ],
    },
  ];
  facts.forEach((c, i) => {
    const x = M + i * (factW + 0.34);
    panel(s, { x, y: 4.3, w: factW, h: 1.28, fill: PANEL, edge: ACCENT });
    s.addText(c.h, {
      x: x + 0.28, y: 4.4, w: factW - 0.46, h: 0.28,
      fontFace: SANS, fontSize: 13, bold: true, color: INK, valign: "middle",
    });
    s.addText(c.rows.map((r) => ({ text: r, options: { breakLine: true } })), {
      x: x + 0.28, y: 4.7, w: factW - 0.46, h: 0.82,
      fontFace: SANS, fontSize: 10.5, color: BODY, valign: "top", lineSpacing: 14.5,
    });
  });

  panel(s, { x: M, y: 5.76, w: CW, h: 0.52, fill: PANEL });
  s.addText(
    "Next.js 16 · React 19 · TypeScript · Supabase (Postgres + pgvector + RLS) · OpenAI · Azure Speech",
    {
      x: M + 0.3, y: 5.76, w: CW - 0.5, h: 0.52,
      fontFace: SANS, fontSize: 11, color: BODY, valign: "middle",
    },
  );

  s.addNotes(TALK.s1);
  chrome(s);
}

/* =================================================================== SLIDE 2
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
    [
      { text: "Why score before generating?  ", options: { bold: true, color: ACCENT } },
      { text: "A verdict that only arrives at the end of the interview cannot change the interview. Scoring first is what makes the questioning adaptive rather than scripted — and bounding it at 4 s is what stops that costing a stalled reply.", options: { color: INK } },
    ],
    {
      x: M + 0.34, y: 4.92, w: CW - 0.6, h: 0.86,
      fontFace: SANS, fontSize: 13, valign: "middle", lineSpacing: 18,
    },
  );

  s.addText(
    "src/app/api/chat/route.ts  ·  src/lib/response-analyzer.ts  ·  src/lib/decision-engine.ts  ·  migration 0005",
    { x: M, y: 5.9, w: CW, h: 0.28, fontFace: MONO, fontSize: 9.5, color: MUTED, valign: "middle" },
  );

  s.addNotes(TALK.s2);
  chrome(s);
}

/* =================================================================== SLIDE 3
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
      { text: "the dials are coarse — strictness 1→10 moves difficulty only 5→7, and 5/6/7 emit byte-identical prompts. Scoring is persona-blind ", options: { color: BODY } },
      { text: "by design", options: { color: BODY, italic: true } },
      { text: ": a strict interviewer and a warm one grade the same answer identically, because grading should not depend on who asked. Persona changes what gets asked next, never what an answer was worth.", options: { color: BODY } },
    ],
    { x: M, y: 5.94, w: CW, h: 0.62, fontFace: SANS, fontSize: 10.5, valign: "top", lineSpacing: 14.5 },
  );

  s.addNotes(TALK.s3);
  chrome(s);
}

/* =================================================================== SLIDE 4
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
      { text: " engage. On a bare session the stable prefix is about 590 tokens — under the floor — so it does not fire at all. The tool reports that in words, rather than printing a zero for me to reinterpret.", options: { color: BODY } },
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

  s.addNotes(TALK.s4);
  chrome(s);
}

/* =================================================================== SLIDE 5
   Status, limits, and the demo  (merged)
   ========================================================================= */
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  head(s, "Where it stands", "Built, measured, and not yet — then the demo.");

  const colW = (CW - 0.34 * 2) / 3;
  const cols = [
    {
      mark: "✔",
      color: GREEN,
      soft: GREEN_SOFT,
      h: "Built and verified",
      why: "“Verified” means a command you can run, or a test that fails when the claim stops being true.",
      rows: [
        "299 tests across 31 files, all passing",
        "CI: typecheck + lint + test on every push",
        "10 migrations; RLS on every table",
        "Six round types, text and voice",
        "JD + CV grounding via pgvector, inside Postgres",
      ],
    },
    {
      mark: "◑",
      color: AMBER,
      soft: AMBER_SOFT,
      h: "Built, not yet measured",
      why: "Every run is billed, so I settled the metrics and fixtures first — the first run is the real one, not a pilot.",
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
      why: "Each is a bounded, documented trade-off — recorded here rather than found by someone else.",
      rows: [
        "Code is reviewed, never executed",
        "English only",
        "No CSP yet — pending an audit of the speech websocket origins",
        "Rate limiter is in-process",
      ],
    },
  ];

  cols.forEach((c, i) => {
    const x = M + i * (colW + 0.34);
    panel(s, { x, y: 1.74, w: colW, h: 2.6, fill: c.soft, edge: c.color });
    s.addText(`${c.mark}  ${c.h}`, {
      x: x + 0.28, y: 1.86, w: colW - 0.46, h: 0.3,
      fontFace: SANS, fontSize: 13, bold: true, color: c.color, valign: "middle",
    });
    const runs = [];
    c.rows.forEach((r, j) => {
      runs.push({ text: r, options: { breakLine: true } });
      if (j < c.rows.length - 1) runs.push({ text: "", options: { breakLine: true, fontSize: 5 } });
    });
    s.addText(runs, {
      x: x + 0.28, y: 2.22, w: colW - 0.46, h: 1.6,
      fontFace: SANS, fontSize: 10.5, color: BODY, valign: "top", lineSpacing: 14.5,
    });
    s.addText(c.why, {
      x: x + 0.28, y: 3.86, w: colW - 0.46, h: 0.42,
      fontFace: SANS, fontSize: 9.5, italic: true, color: c.color,
      valign: "top", lineSpacing: 13,
    });
  });

  panel(s, { x: M, y: 4.46, w: CW, h: 0.6, fill: ACCENT_SOFT, edge: ACCENT });
  s.addText(
    [
      { text: "The rule I held to:  ", options: { bold: true, color: ACCENT } },
      { text: "never claim a number I have not run. That is why the middle column is on this slide rather than left off it.", options: { color: INK } },
    ],
    { x: M + 0.34, y: 4.46, w: CW - 0.6, h: 0.6, fontFace: SANS, fontSize: 12.5, valign: "middle" },
  );

  s.addText("Now the demo — three things, in increasing order of what can go wrong.", {
    x: M, y: 5.16, w: CW, h: 0.28,
    fontFace: SANS, fontSize: 12, bold: true, color: INK, valign: "middle",
  });

  const demo = [
    { n: "01", t: "Personas actually differ", cmd: "npm run eval:persona", risk: "Deterministic — cannot fail", c: GREEN, soft: GREEN_SOFT },
    { n: "02", t: "What it has cost", cmd: "npm run cost-report", risk: "Reads llm_usage", c: AMBER, soft: AMBER_SOFT },
    { n: "03", t: "A live interview", cmd: "npm run dev", risk: "Strict persona, short round", c: AMBER, soft: AMBER_SOFT },
  ];
  demo.forEach((d, i) => {
    const x = M + i * (colW + 0.34);
    panel(s, { x, y: 5.5, w: colW, h: 0.94, fill: d.soft, edge: d.c });
    s.addText(`${d.n}  ·  ${d.t}`, {
      x: x + 0.28, y: 5.6, w: colW - 0.46, h: 0.26,
      fontFace: SANS, fontSize: 12, bold: true, color: INK, valign: "middle",
    });
    s.addText(d.cmd, {
      x: x + 0.28, y: 5.88, w: colW - 0.46, h: 0.24,
      fontFace: MONO, fontSize: 10, color: ACCENT, valign: "middle",
    });
    s.addText(d.risk, {
      x: x + 0.28, y: 6.12, w: colW - 0.46, h: 0.24,
      fontFace: SANS, fontSize: 9.5, italic: true, color: d.c, valign: "middle",
    });
  });

  s.addNotes(TALK.s5);
  chrome(s);
}

/* ================================================================ APPENDIX
   Not presented. There for questions.
   ========================================================================= */

function appendixDivider() {
  const s = pptx.addSlide();
  s.background = { color: INK };
  s.addText("Thank you", {
    x: M, y: 2.9, w: CW, h: 0.8,
    fontFace: SANS, fontSize: 40, bold: true, color: WHITE, valign: "middle",
  });
  s.addText("Questions. Supporting material follows — not presented.", {
    x: M, y: 3.76, w: CW, h: 0.4,
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

/* ---------------------------------------------- SCRIPT.md — section 1 only */

{
  const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "SCRIPT.md");
  const md = [
    "# Section 1 — the talk",
    "",
    `**Five slides, ${TOTAL_WORDS} words — about ${clock((TOTAL_WORDS / WPM) * 60)} at a rehearsed ${WPM} wpm**`,
    `(nearer ${clock((TOTAL_WORDS / 165) * 60)} if you speak quickly). The demo is the main event, so the talk stays lean.`,
    "",
    "These are the same words embedded as speaker notes in the `.pptx`. Both are",
    "generated from the `SLIDES` array in `build-deck.mjs`, so they cannot drift apart.",
    "",
    "**Slides 2, 3 and 4 carry the argument.** If you are running long, compress slide 1",
    "(the problem is one line — say it once) and the closing half of slide 5.",
    "",
    "---",
    "",
  ];
  for (const s of SLIDES) {
    md.push(`### Slide ${s.id.slice(1)} · ${s.title} — \`${s.at}\`${s.star ? "  \u2605" : ""}`, "");
    for (const para of wrap(s.talk, 76).split("\n\n")) {
      md.push(...para.split("\n").map((l) => "> " + l), ">");
    }
    md.pop();
    md.push("");
    if (s.short) md.push(`**Short: "${s.short}"**`, "");
    md.push("---", "");
  }

  const cur = fs.readFileSync(SCRIPT, "utf8");
  const a = cur.indexOf("# Section 1");
  const b = cur.indexOf("# Section 2");
  if (a === -1 || b === -1) throw new Error("SCRIPT.md is missing its Section 1/2 markers");
  fs.writeFileSync(SCRIPT, cur.slice(0, a) + md.join("\n") + "\n" + cur.slice(b));
  console.log("wrote", SCRIPT, `— section 1, ${TOTAL_WORDS} words, ${clock((TOTAL_WORDS / WPM) * 60)}`);
}
