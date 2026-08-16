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
    title: "What it is, and what's built",
    star: false,
    extra: "FILL IN before presenting: your supervisor's name and the date.",
    short: "Question banks don't adapt, humans don't scale, chatbots don't score. ConvoTrainer scores every answer and uses that score to choose the next question.",
    talk: `Good morning. My final year project is ConvoTrainer, an interview practice application.

All three ways of practising today have the same hole. A question bank asks the same things in the same order; it never notices you dodged the question. A human adapts perfectly, but isn't available at eleven at night. A general chatbot will role-play, but won't grade you against a rubric or push back when you're weak. Nothing connects how you answered to what you get asked next. That loop is the project.

You describe the role, optionally attaching the real job description and your resume to ground the questions. You pick the rounds, shape the interviewer, and interview.

Six round types, each judged on its own rubric — a system design answer isn't assessed the way a behavioural one is. Text or voice, with a code editor on technical rounds. Afterwards, a scored report with per-answer coaching, model answers and competency coverage.

The remaining four slides are how that works underneath.`,
  },
  {
    id: "s2",
    title: "How one turn works",
    star: true,
    extra: "KEY SLIDE — the architecture. Do not rush it.",
    short: null,
    talk: `This is the shape of a single turn, left to right.

Your answer arrives at the server. Before any question is generated, a second model call scores that answer against the rubric for the round you're in.

The verdict goes into a decision engine — ordinary deterministic code, no model involved. It chooses how to question you next and sets a difficulty target. That becomes a private instruction attached to the interviewer's prompt, which you never see. Then the next question streams back.

Why that order? A verdict that only arrives at the end of the interview cannot change the interview. Scoring before generating is what makes the questioning adaptive rather than scripted.

Two engineering points. Scoring is bounded at four seconds, so a slow scorer never leaves you staring at a blank screen — past the deadline the question is generated unsteered, but the score is still recorded. And both messages and the score are written in one database transaction, so a turn can't half-exist.

One thing to be clear about, because the word gets used loosely: this is not an agent. There are no tools for the model to call and no autonomous planning. The model generates; the code decides — and that is what makes a run reproducible.`,
  },
  {
    id: "s3",
    title: "What it's built on",
    star: false,
    extra: "The stack slide. If asked about anything here, the appendix has the detail.",
    short: null,
    talk: `What it's built on, in four parts.

Language models: one model, GPT-4o-mini, does the interviewing, the scoring, the summarising and the coaching. It's called over plain HTTPS — no SDK, no agent framework. Replies stream token by token; scoring runs at low temperature and returns structured JSON so it's repeatable.

Speech: Azure AI Speech in both directions — continuous speech-to-text while you talk, neural voices for the interviewer. It speaks sentence by sentence while the reply is still being written. The Azure key never reaches the browser; the page asks my server for a nine-minute token instead.

Grounding: a job description is uploaded or pasted, cleaned up, split into overlapping chunks, embedded, and stored as vectors in Postgres using pgvector. Each turn retrieves the most relevant passages. Short documents skip all that and go in whole, because retrieval would cost more than it saves. The resume is read directly.

Data: Supabase Postgres, fifteen migrations, row-level security on all nine tables.

The decision worth defending is the third one. Search lives inside the database, so it inherits the same per-user access rules as every other table. A separate vector database would have been a second place to get authorisation right.

Continuous integration runs typecheck, lint, four hundred and eighty-two tests and a production build on every push. The deployment runbook is written, but I have not deployed yet.`,
  },
  {
    id: "s4",
    title: "Token usage and cost control",
    star: true,
    extra: "KEY SLIDE — the negative result is the point, not a caveat.",
    short: null,
    talk: `I don't estimate what this costs. I measure it.

Every model call records its own token usage, including how much was served from cache, as it happens. A reporting tool prices that — tokens per call site, cache hit rate, cost per turn. So any cost figure I give you is a query you can re-run, not a number I worked out on paper.

Several things got cut once I could see where the tokens went. Trivial answers like "ok" skip scoring entirely. Anything countable — word count, hedging, whether you gave a metric — is computed in plain code instead of asked of the model, because counting isn't judgement and a model has no reason to count accurately. Coaching answers are cached, and a rolling summary replaces resending the transcript.

The most useful result was a negative one. The provider only caches a prompt prefix once it reaches one thousand and twenty-four tokens. I'd deliberately ordered the prompt with the unchanging part first, so caching could engage. Then I measured it: on a plain session that stable part is about five hundred and ninety tokens. Under the floor. It never fires.

I kept the ordering, because it costs nothing and it's what makes caching work once a job description is attached — which is when the prompt is big enough to matter. But the tool reports that it didn't fire, in words, rather than printing a zero I could quietly reinterpret.

So the claim isn't that this is cheap. It's that every call is instrumented and checkable, including the optimisation that provably doesn't work.`,
  },
  {
    id: "s5",
    title: "How it decides, and what you control",
    star: true,
    extra: "KEY SLIDE — this answers 'how does the scoring and questioning actually work'.",
    short: null,
    talk: `Last slide: what's inside the two decision boxes, and what you can change.

Scoring first. The rubric is chosen by round type — a behavioural answer is judged on situation, task, action and result; a technical one on problem framing, correctness, complexity, edge cases and code quality. It runs at low temperature and returns structured JSON, so the same answer doesn't swing between runs. Anything countable is computed in code rather than asked of the model. If the model leaves a field out, it gets a neutral default and the omission is recorded — never silently zero. And scoring never sees the persona, because grading shouldn't depend on who asked.

Choosing the next question is a fixed ladder over those scores. Didn't set the scene? It clarifies. Vague answer? It drills for specifics. Said "we" instead of "I"? It challenges ownership. Seven strategies, first match wins. Ask the same way twice and it escalates and raises the difficulty. It also steers toward competencies you haven't covered yet, and it's given its last ten questions with instructions not to repeat them.

What you control is the third column: the rounds and their length, the interviewer's background and four dials, text or voice, and your real documents.

I want to be precise about the boundary. The surface is configurable; the decision core is not. Only strictness and warmth feed those calculations — every threshold is fixed. That's deliberate: it's why a run is reproducible and unit-testable.

And here's what that buys. Same question, same answer, only the interviewer differs — the difficulty target moves from five to seven. Not a sample from a stochastic model: a computation that reproduces exactly, offline, every run.

One confound I'll state before you're asked: a warmer interviewer sets easier questions, so scores aren't comparable across personas. The system knows that and says so in the interface.`,
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
   What it is, and what's built
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
    { x: M + 0.24, y: 1.34, w: CW - 0.5, h: 0.36, fontFace: SANS, fontSize: 16, color: BODY, valign: "middle" },
  );
  s.addText(
    [
      { text: "Dylan Tan", options: { bold: true, color: INK } },
      { text: "   ·   Supervisor: «name»   ·   «date»", options: { color: MUTED } },
    ],
    { x: M + 0.24, y: 1.72, w: CW - 0.5, h: 0.26, fontFace: SANS, fontSize: 12, valign: "middle" },
  );

  panel(s, { x: M, y: 2.2, w: CW, h: 0.74, fill: ACCENT_SOFT, edge: ACCENT });
  s.addText(
    [
      { text: "Question banks don't adapt. Humans don't scale. Chatbots don't score.   ", options: { color: BODY } },
      { text: "Nothing connects how you answered to what you get asked next.", options: { bold: true, color: INK } },
    ],
    { x: M + 0.34, y: 2.2, w: CW - 0.6, h: 0.74, fontFace: SANS, fontSize: 13.5, valign: "middle", lineSpacing: 19 },
  );

  steps(s, [
    { tag: "STEP 1", title: "Context", body: "Role, job description, resume" },
    { tag: "STEP 2", title: "Rounds", body: "One round, or a full loop" },
    { tag: "STEP 3", title: "Interviewer", body: "Persona and four dials" },
    { tag: "STEP 4", title: "Review", body: "Confirm and launch" },
  ], { y: 3.1, h: 1.02 });

  const factW = (CW - 0.34 * 2) / 3;
  [
    {
      h: "Six round types",
      rows: [
        "Screening · behavioural · HR",
        "Technical · system design · case",
        "Each judged on its own rubric",
        "Length, focus and order are yours",
      ],
    },
    {
      h: "Text or voice",
      rows: [
        "Replies stream as they are written",
        "Spoken aloud, sentence by sentence",
        "Code editor on technical rounds",
        "Coaching updates as you answer",
      ],
    },
    {
      h: "A scored report",
      rows: [
        "Score breakdown per dimension",
        "Per-answer coaching, model answers",
        "Competency coverage across 12",
        "Guess your score before the reveal",
      ],
    },
  ].forEach((c, i) => {
    const x = M + i * (factW + 0.34);
    panel(s, { x, y: 4.3, w: factW, h: 1.62, fill: PANEL, edge: ACCENT });
    s.addText(c.h, {
      x: x + 0.28, y: 4.42, w: factW - 0.46, h: 0.28,
      fontFace: SANS, fontSize: 13, bold: true, color: INK, valign: "middle",
    });
    s.addText(c.rows.map((r) => ({ text: r, options: { breakLine: true } })), {
      x: x + 0.28, y: 4.74, w: factW - 0.46, h: 1.06,
      fontFace: SANS, fontSize: 10.5, color: BODY, valign: "top", lineSpacing: 15,
    });
  });

  s.addNotes(TALK.s1);
  chrome(s);
}

/* =================================================================== SLIDE 2
   How one turn works  ★
   ========================================================================= */
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  head(s, "Architecture", "One turn: score the answer first, then decide what to ask.");

  const boxes = [
    { t: "Your answer", b: "text, code\nor speech", c: MUTED },
    { t: "Score it", b: "against the rubric\nfor this round", c: ACCENT },
    { t: "Decide", b: "how to question next\n+ a difficulty target", c: ACCENT },
    { t: "Steer privately", b: "attached to the prompt\nnever shown to you", c: ACCENT },
    { t: "Next question", b: "streams back", c: MUTED },
  ];

  const gap = 0.3;
  const bw = (CW - gap * (boxes.length - 1)) / boxes.length;
  const by = 1.84;
  const bh = 1.5;

  boxes.forEach((b, i) => {
    const x = M + i * (bw + gap);
    const core = b.c === ACCENT;
    s.addShape(pptx.ShapeType.rect, {
      x, y: by, w: bw, h: bh,
      fill: { color: core ? ACCENT_SOFT : PANEL },
      line: { color: core ? ACCENT : LINE, width: core ? 1.25 : 1 },
    });
    s.addText(b.t, {
      x: x + 0.14, y: by + 0.22, w: bw - 0.28, h: 0.34,
      fontFace: SANS, fontSize: 13.5, bold: true, color: INK, align: "center", valign: "middle",
    });
    s.addText(b.b, {
      x: x + 0.1, y: by + 0.62, w: bw - 0.2, h: 0.74,
      fontFace: SANS, fontSize: 10.5, color: core ? ACCENT : MUTED,
      align: "center", valign: "top", lineSpacing: 14,
    });
    if (i < boxes.length - 1) {
      s.addText("▸", {
        x: x + bw, y: by + bh / 2 - 0.16, w: gap, h: 0.32,
        fontFace: SANS, fontSize: 16, bold: true, color: ACCENT, align: "center", valign: "middle",
      });
    }
  });

  const annW = (CW - 0.34) / 2;
  panel(s, { x: M, y: 3.58, w: annW, h: 1.06, fill: AMBER_SOFT, edge: AMBER });
  s.addText(
    [
      { text: "Bounded, not blocking.  ", options: { bold: true, color: AMBER } },
      { text: "Scoring gets four seconds. Past that the question is generated unsteered — but the score is still recorded, so the report and the next turn are unaffected.", options: { color: BODY } },
    ],
    { x: M + 0.3, y: 3.68, w: annW - 0.5, h: 0.88, fontFace: SANS, fontSize: 11.5, valign: "top", lineSpacing: 16 },
  );

  panel(s, { x: M + annW + 0.34, y: 3.58, w: annW, h: 1.06, fill: GREEN_SOFT, edge: GREEN });
  s.addText(
    [
      { text: "All or nothing.  ", options: { bold: true, color: GREEN } },
      { text: "Both messages and the score are written in one database transaction, so a turn can never half-exist — even if the connection drops mid-reply.", options: { color: BODY } },
    ],
    { x: M + annW + 0.64, y: 3.68, w: annW - 0.5, h: 0.88, fontFace: SANS, fontSize: 11.5, valign: "top", lineSpacing: 16 },
  );

  panel(s, { x: M, y: 4.92, w: CW, h: 0.82, fill: ACCENT_SOFT, edge: ACCENT });
  s.addText(
    [
      { text: "Why score before generating?  ", options: { bold: true, color: ACCENT } },
      { text: "A verdict that only arrives at the end of the interview cannot change the interview. Scoring first is what makes the questioning adaptive rather than scripted.", options: { color: INK } },
    ],
    { x: M + 0.34, y: 4.92, w: CW - 0.6, h: 0.82, fontFace: SANS, fontSize: 13, valign: "middle", lineSpacing: 18 },
  );

  s.addText(
    "Not an agent: there are no tools for the model to call and no autonomous planning. The model generates; the code decides.",
    { x: M, y: 5.88, w: CW, h: 0.32, fontFace: SANS, fontSize: 11, italic: true, color: MUTED, valign: "middle" },
  );

  s.addNotes(TALK.s2);
  chrome(s);
}

/* =================================================================== SLIDE 3
   What it's built on
   ========================================================================= */
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  head(s, "Tech stack", "What it's built on, and how the pieces connect.");

  const qw = (CW - 0.34) / 2;
  const quads = [
    {
      x: M, y: 1.74,
      h: "Language models",
      rows: [
        "GPT-4o-mini interviews, scores, summarises and coaches",
        "Called over plain HTTPS — no SDK, no agent framework",
        "Replies streamed token by token",
        "Scoring runs at low temperature, returns structured JSON",
      ],
    },
    {
      x: M + qw + 0.34, y: 1.74,
      h: "Speech",
      rows: [
        "Azure AI Speech — continuous speech-to-text",
        "Neural voices, six to choose from",
        "Spoken sentence by sentence while still being written",
        "Keys stay server-side; the browser gets a 9-minute token",
      ],
    },
    {
      x: M, y: 3.46,
      h: "Grounding your documents",
      rows: [
        "Job description uploaded as PDF or pasted, then cleaned",
        "Split into overlapping chunks and embedded as vectors",
        "Stored and searched in Postgres with pgvector",
        "Short documents skip retrieval and go in whole; resume read directly",
      ],
    },
    {
      x: M + qw + 0.34, y: 3.46,
      h: "Data and platform",
      rows: [
        "Supabase Postgres · 15 migrations",
        "Row-level security on all 9 tables",
        "Supabase Auth, cookie-based sessions",
        "Next.js and React on the front end",
      ],
    },
  ];

  quads.forEach((q) => {
    panel(s, { x: q.x, y: q.y, w: qw, h: 1.6, fill: PANEL, edge: ACCENT });
    s.addText(q.h, {
      x: q.x + 0.3, y: q.y + 0.12, w: qw - 0.5, h: 0.3,
      fontFace: SANS, fontSize: 13.5, bold: true, color: INK, valign: "middle",
    });
    s.addText(q.rows.map((r) => ({ text: r, options: { breakLine: true } })), {
      x: q.x + 0.3, y: q.y + 0.46, w: qw - 0.5, h: 1.02,
      fontFace: SANS, fontSize: 11, color: BODY, valign: "top", lineSpacing: 15.5,
    });
  });

  panel(s, { x: M, y: 5.18, w: CW, h: 0.62, fill: ACCENT_SOFT, edge: ACCENT });
  s.addText(
    [
      { text: "The decision worth defending:  ", options: { bold: true, color: ACCENT } },
      { text: "search lives inside the database, so it inherits the same per-user access rules as every other table. A separate vector database would be a second place to get authorisation right.", options: { color: INK } },
    ],
    { x: M + 0.34, y: 5.18, w: CW - 0.6, h: 0.62, fontFace: SANS, fontSize: 12, valign: "middle", lineSpacing: 16 },
  );

  panel(s, { x: M, y: 5.92, w: CW, h: 0.56, fill: PANEL });
  s.addText(
    [
      { text: "Verified:  ", options: { bold: true, color: GREEN } },
      { text: "every push runs typecheck, lint, 482 tests and a production build.    ", options: { color: BODY } },
      { text: "Not yet:  ", options: { bold: true, color: AMBER } },
      { text: "scoring-accuracy study and user testing are designed but not run; deployment runbook written, not yet deployed.", options: { color: BODY } },
    ],
    { x: M + 0.3, y: 5.92, w: CW - 0.5, h: 0.56, fontFace: SANS, fontSize: 10.5, valign: "middle", lineSpacing: 14 },
  );

  s.addNotes(TALK.s3);
  chrome(s);
}

/* =================================================================== SLIDE 4
   Token usage and cost control  ★
   ========================================================================= */
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  head(s, "Token usage", "Every model call is instrumented, so cost is a query — not a claim.");

  const chain = [
    "Every model call",
    "records its own token usage",
    "a report prices it",
    "tokens · cache hits · cost per turn",
  ];
  const gap = 0.28;
  const bw = (CW - gap * (chain.length - 1)) / chain.length;
  chain.forEach((t, i) => {
    const x = M + i * (bw + gap);
    const last = i === chain.length - 1;
    s.addShape(pptx.ShapeType.rect, {
      x, y: 1.8, w: bw, h: 0.66,
      fill: { color: last ? ACCENT_SOFT : PANEL },
      line: { color: last ? ACCENT : LINE, width: 1 },
    });
    s.addText(t, {
      x: x + 0.1, y: 1.8, w: bw - 0.2, h: 0.66,
      fontFace: SANS, fontSize: 11, color: last ? ACCENT : BODY,
      align: "center", valign: "middle", lineSpacing: 14,
    });
    if (!last) {
      s.addText("▸", {
        x: x + bw, y: 1.96, w: gap, h: 0.34,
        fontFace: SANS, fontSize: 14, color: MUTED, align: "center", valign: "middle",
      });
    }
  });

  panel(s, { x: M, y: 2.72, w: CW, h: 1.84, fill: AMBER_SOFT, edge: AMBER });
  s.addText("The most useful result is a negative one", {
    x: M + 0.34, y: 2.86, w: CW - 0.7, h: 0.32,
    fontFace: SANS, fontSize: 15, bold: true, color: AMBER, valign: "middle",
  });
  s.addText(
    [
      { text: "The provider only caches a prompt prefix once it reaches 1,024 tokens. I ordered the prompt so the unchanging part comes first and the varying part last, specifically so caching ", options: { color: BODY } },
      { text: "can", options: { color: INK, bold: true, italic: true } },
      { text: " engage. Then I measured it: on a plain session that stable part is about 590 tokens — under the floor — so it never fires. The tool reports that in words, rather than printing a zero for me to reinterpret.", options: { color: BODY } },
    ],
    { x: M + 0.34, y: 3.2, w: CW - 0.7, h: 0.88, fontFace: SANS, fontSize: 12.5, valign: "top", lineSpacing: 18 },
  );
  s.addText(
    "It does fire once a job description is attached — which is exactly when the prompt is large enough for it to matter. Padding the prompt to reach the floor would cost more than the discount returns.",
    { x: M + 0.34, y: 4.06, w: CW - 0.7, h: 0.44, fontFace: SANS, fontSize: 11, italic: true, color: MUTED, valign: "top", lineSpacing: 15 },
  );

  const halfW = (CW - 0.34) / 2;
  panel(s, { x: M, y: 4.74, w: halfW, h: 1.16, fill: PANEL });
  s.addText(
    [
      { text: "What measuring let me cut", options: { bold: true, color: INK, breakLine: true } },
      { text: "Trivial answers skip scoring · anything countable computed in code, not asked of the model · coaching answers cached so reopening a report doesn't re-bill · a rolling summary instead of resending the transcript · one model throughout, because a second model means a second cache", options: { color: BODY } },
    ],
    { x: M + 0.28, y: 4.84, w: halfW - 0.5, h: 1.0, fontFace: SANS, fontSize: 10.5, valign: "top", lineSpacing: 14.5 },
  );

  panel(s, { x: M + halfW + 0.34, y: 4.74, w: halfW, h: 1.16, fill: ACCENT_SOFT, edge: ACCENT });
  s.addText(
    [
      { text: "The claim is not “this is cheap.”", options: { bold: true, color: ACCENT, breakLine: true } },
      { text: "It is that every call is instrumented, priced and checkable — including the optimisation that provably does not fire. A round costs roughly a cent, and that figure is still an estimate until I run the report against live traffic.", options: { color: INK } },
    ],
    { x: M + halfW + 0.62, y: 4.84, w: halfW - 0.5, h: 1.0, fontFace: SANS, fontSize: 10.5, valign: "top", lineSpacing: 14.5 },
  );

  s.addNotes(TALK.s4);
  chrome(s);
}

/* =================================================================== SLIDE 5
   How it decides, and what you control  ★
   ========================================================================= */
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  head(s, "The decision core", "How an answer is scored, how the next question is picked, what you control.");

  const colW = (CW - 0.34 * 2) / 3;
  const cols = [
    {
      h: "How an answer is scored",
      edge: ACCENT,
      rows: [
        "The rubric is chosen by round type",
        "Behavioural: situation, task, action, result",
        "Technical: framing, correctness, complexity, edge cases, code quality",
        "Countable things computed in code, not asked of the model",
        "Never sees the persona — grading shouldn't depend on who asked",
      ],
    },
    {
      h: "How the next question is picked",
      edge: ACCENT,
      rows: [
        "A fixed ladder over those scores picks 1 of 7 strategies",
        "Vague → drill for specifics.  “We” → challenge ownership",
        "Same strategy twice → escalate, raise difficulty",
        "Steers toward uncovered competencies; won't repeat its last 10 questions",
      ],
    },
    {
      h: "What you configure",
      edge: GREEN,
      rows: [
        "6 round types · length · focus · multi-round loops",
        "Interviewer: style, seniority, industry, experience",
        "Four dials 1–10: strictness · warmth · pace · pushback",
        "Text or voice · 6 voices · code editor on technical rounds",
        "Your real job description and resume",
      ],
    },
  ];

  cols.forEach((c, i) => {
    const x = M + i * (colW + 0.34);
    panel(s, { x, y: 1.74, w: colW, h: 2.72, fill: PANEL, edge: c.edge });
    s.addText(c.h, {
      x: x + 0.28, y: 1.86, w: colW - 0.46, h: 0.3,
      fontFace: SANS, fontSize: 12.5, bold: true, color: c.edge, valign: "middle",
    });
    const runs = [];
    c.rows.forEach((r, j) => {
      runs.push({ text: r, options: { breakLine: true } });
      if (j < c.rows.length - 1) runs.push({ text: "", options: { breakLine: true, fontSize: 5 } });
    });
    s.addText(runs, {
      x: x + 0.28, y: 2.22, w: colW - 0.46, h: 2.14,
      fontFace: SANS, fontSize: 10.5, color: BODY, valign: "top", lineSpacing: 14.5,
    });
  });

  panel(s, { x: M, y: 4.58, w: CW, h: 0.72, fill: AMBER_SOFT, edge: AMBER });
  s.addText(
    [
      { text: "Be precise about the boundary:  ", options: { bold: true, color: AMBER } },
      { text: "the surface is configurable, the decision core is not. Only strictness and warmth feed those calculations — every threshold is fixed. That is deliberate: fixed thresholds are why a run is reproducible and unit-testable.", options: { color: INK } },
    ],
    { x: M + 0.34, y: 4.58, w: CW - 0.6, h: 0.72, fontFace: SANS, fontSize: 12, valign: "middle", lineSpacing: 17 },
  );

  panel(s, { x: M, y: 5.42, w: CW, h: 0.86, fill: ACCENT_SOFT, edge: ACCENT });
  s.addText(
    [
      { text: "And here is what that buys.  ", options: { bold: true, color: ACCENT } },
      { text: "Same question, same answer — only the interviewer differs. The difficulty target moves from 5 to 7. Not a sample from a stochastic model: a computation that reproduces exactly, offline, every run.", options: { color: INK } },
    ],
    { x: M + 0.34, y: 5.42, w: CW - 0.6, h: 0.86, fontFace: SANS, fontSize: 13, valign: "middle", lineSpacing: 18 },
  );

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
        { lead: "API", rest: "22 route files — auth-gated, rate-limited, RLS-backed" },
        { lead: "Domain", rest: "pure, unit-tested logic: analyzer, decision engine, rounds, competencies, summary" },
        { lead: "Data", rest: "src/lib/db — the only place SQL shapes live" },
        { lead: "Operator", rest: "src/eval — CLI only, never bundled" },
      ],
    },
    {
      h: "Why it is shaped this way",
      rows: [
        { lead: "Domain logic is pure", rest: "so it can be tested without a network or a database. That is why there are 482 tests and no mocking framework." },
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
        { lead: "15 migrations", rest: "sessions, messages, personas, job descriptions, resumes, turn analyses, usage, coach answers, integrity constraints, server-owned writes, document metadata" },
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
        { lead: "The resume is read directly, not retrieved", rest: "short enough to fit whole, so chunking and embedding it would cost more than it saves. An earlier version distilled it to a summary; that was removed so the interviewer reads what the candidate actually wrote" },
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
        { lead: "482 tests, 55 files, all passing.", rest: "Pure logic plus route handlers — the route tests cover authentication, input bounds and the prompt trust boundary." },
        { lead: "No network in the test suite.", rest: "Domain logic was kept pure specifically so this would be possible." },
        { lead: "The speech queue test fakes the Azure SDK contract", rest: "so a regression that stops calling close() fails in CI the same way it failed in the browser." },
        { lead: "CI runs typecheck, lint, the tests and a production build", rest: "on every push and pull request. The build step catches what types cannot — a missing Suspense boundary is a build failure, not a type error." },
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
  "Good answer to 'how do you know it works?' and to any question about developer tooling being reachable by end users.\n\nOn usage data: an earlier version let a signed-in user insert forged usage rows, because recording ran under their own session. That is now closed — usage is written server-side and attributed to the authenticated user, and the client no longer holds the insert grant. A user can still read their own token counts if they go looking; they cannot read anyone else's, cannot modify any, and cannot derive cost, because the price table is never sent to the browser.",
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
