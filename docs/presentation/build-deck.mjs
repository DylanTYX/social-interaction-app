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
    short: "Practice question lists don't react to you, a real person can't be on call, and a chatbot won't mark you. This marks every answer and uses the mark to pick the next question.",
    onSlide: "What the app is, the gap it fills, the four setup steps, and what you get at the end.",
    qa: [
      { q: `Who is this for?`, a: `People getting ready for job interviews. I built it around tech interviews because that's the process I know best, but nothing about it is tech-only — the sample interviewers include a factory director and a head of marketing.` },
      { q: `Isn't this just ChatGPT with a good prompt?`, a: `The AI does write the questions. But three things around it are mine, and you don't get any of them from a prompt.

First, every answer is marked against a checklist before the next question is written, and that mark decides the question. Second, it reads your actual job advert and resume, so the questions are about that job rather than jobs in general. Third, every AI call is recorded and priced, so I can tell you what it costs instead of guessing.` },
      { q: `Why six kinds of round?`, a: `Because you can't mark them the same way. For a coding answer you care whether it works and whether it handles the odd cases. For a "tell me about a time" answer you care whether the person explained the situation and said what they personally did.

So each kind carries its own checklist and its own follow-up rules. Adding a seventh kind is one small block of settings in one file.` },
      { q: `Does it run the code the candidate writes?`, a: `No. The AI reads the code and comments on it, but nothing is ever run. Running someone else's code safely needs a locked-down sandbox, which is a whole project by itself. The report says the code was reviewed and not run, so nobody is misled.` },
    ],
    talk: `Good morning. My final year project is called ConvoTrainer. It's a website where you practise job interviews against an AI interviewer.

Why it exists: there are three ways to practise today, and all three have the same hole. A list of practice questions asks the same things in the same order, whatever you say. A real person reacts perfectly, but isn't available at eleven at night. A chatbot will play along, but won't mark you or push back when your answer is weak.

None of them connect how you answered to what you get asked next. Closing that gap is the project.

So you tell it what job you're going for, and you can attach the real job advert and your resume. You choose the kind of round, set what the interviewer is like, and start. There are six kinds of round, and each is marked differently — a coding answer isn't judged the way a "tell me about a time" answer is. You can type or speak. At the end you get a report with a score, feedback on every answer, and a better version of each one.

The next four slides are how that works underneath.`,
  },
  {
    id: "s2",
    title: "How one turn works",
    star: true,
    extra: "KEY SLIDE — this is the whole idea. Do not rush it.",
    short: null,
    onSlide: "The four steps of a single turn, which checklist gets used, a real example, and why the marking comes first.",
    qa: [
      { q: `What is actually on the checklist?`, a: `There are two, and the kind of round decides which one is used.

**"Tell me about a time" rounds** check four things: did you describe the situation, was it clear what you were trying to achieve, what did you actually do (and was that you or your team), and what was the result — ideally with numbers.

**Technical rounds** score seven things out of ten: did you understand the problem, was your plan sensible, is the answer correct, is it efficient, did you explain it clearly, did you handle the awkward cases, and is the code tidy.

Both also report how vague the answer was, how confident it sounded, whether it actually answered the question, a list of strengths, a list of gaps, and one overall score out of 100.` },
      { q: `How does it get a score out of 100? Isn't that made up?`, a: `The instructions give it five bands, each with a written definition, and tell it to stick to them rather than treat them as a suggestion.

0–25 — didn't really engage with the question.
26–45 — a genuine attempt, but wrong or missing the point. Trying hard doesn't lift you out of this band.
46–65 — partly there, but shallow or vague.
66–80 — solid. Answers the question with real detail.
81–100 — strong. Specific, well organised, goes beyond the minimum.

It's also told to judge what was said, not how smoothly it was said. A confident answer that's wrong still scores low.` },
      { q: `How does it decide what to ask next?`, a: `It's a list of rules, checked in order, and the first one that matches wins.

For a "tell me about a time" round: if you never set the scene, it asks you to start again with the background. If there was no real detail, it asks for specifics. If you said "we" rather than "I", it asks what you personally did. If you never said how it turned out, it asks for the result. If you scored above 75, it says well done and digs deeper. If none of those apply, it asks more about what you did.

Technical rounds have their own list along the same lines: unclear on the problem, ask them to clarify; weak plan, ask them to think out loud; wrong answer, probe it; missed the awkward cases, drill into those.` },
      { q: `How does it decide how hard the next question is?`, a: `It adds three things together and keeps the result between 1 and 10:

\`difficulty = your score ÷ 10  +  1 if it's repeating itself  +  (strictness − warmth) ÷ 4\`

So an answer scoring in the 50s starts at 6. A strict interviewer — strictness 9, warmth 4 — adds (9−4)÷4, which is 1.25, giving **7**. A warm one — strictness 6, warmth 9 — adds (6−9)÷4, which is −0.75, giving **5**.

That's the 5-versus-7 on this deck, and it's arithmetic you can do on paper.` },
      { q: `Why does a better answer get a harder question?`, a: `Because the starting point is your score divided by ten. Answer well and it pushes you; struggle and it eases off. That's what a good interviewer does.

There's a separate rule for when you're doing badly — it makes things tougher when the answer is weak, or when the system is about to ask the same sort of question twice in a row.` },
      { q: `What if the marking is slow, or fails?`, a: `It gets four seconds. If it isn't finished, the next question is written without it, so you're never left waiting at a blank screen. The mark still gets saved a moment later, so your report and the following question aren't affected. If the marking fails completely, the interview simply carries on unguided for that one turn.` },
      { q: `Does the candidate see the mark during the interview?`, a: `No. The instruction is attached to the interviewer's side of the conversation, and the interviewer is told never to read it out. You can turn on short live tips if you want them, and the full breakdown appears in the report at the end.` },
    ],
    talk: `Here's the core idea, and it's the one thing I'd like to land.

Four steps. You answer. The system marks that answer. It uses the mark to decide what to ask next. Then it asks the follow-up.

The example at the bottom is a real question and answer from my test set. Asked about a project with an unrealistic deadline, the candidate says: "We had a launch date that was pretty tight. I worked with the team and we managed to get most of it done on time."

A human interviewer would spot two things straight away. There's nothing concrete — no dates, no numbers. And it's "we" all the way through, so you can't tell what this person actually did.

That's exactly what the system checks for. So instead of moving on, the follow-up presses for what they personally did.

Why mark it first, rather than at the end? Because a score that only turns up at the end can't change the interview. Marking first is the whole reason the questions react to you instead of running down a list.

And one word I want to be careful with: this isn't an AI agent. The AI writes the questions and marks the answers, but it doesn't decide what happens next. My code does. That's on purpose — it means the same answer leads to the same decision every time, and I can test it.`,
  },
  {
    id: "s3",
    title: "What it's built from",
    star: false,
    extra: "The stack slide. Keep it moving — the detail is in the notes.",
    short: null,
    onSlide: "The four building blocks — the AI, speech, your documents, storage — plus what is and isn't finished.",
    qa: [
      { q: `Why this AI model and not a bigger one?`, a: `Cost, mostly — every answer needs two AI calls, so the price adds up fast.

There's a second reason. Using one model everywhere means there is one set of instructions being repeated, which is what makes the discount on the next slide possible at all. I originally used a bigger model just for the opening question and removed it, because mixing two models meant neither could reuse the other's instructions. Which model it uses is a setting — changing it is one line.` },
      { q: `Why not use an AI framework like LangChain?`, a: `There was nothing for it to do. This is two prompts and a set of rules written in ordinary code. A framework would have added something extra to install and learn without removing any of the code I'd still have to write — and it would have made the logic harder to test, not easier.` },
      { q: `What does "searched by meaning" mean?`, a: `Every piece of the job advert is turned into a long list of numbers that stands for what that piece means. When the system needs something, the thing it's looking for is turned into numbers the same way, and the closest pieces come back.

The practical effect: a question about leading people will find a line saying "line management responsibility", even though the two share no words. A keyword search would miss it.` },
      { q: `Why keep the search in the database instead of a dedicated search product?`, a: `So there is one place, and only one place, that decides who can see what. The search runs inside the database and filters by who is logged in, so even a mistake in my own code can't hand back someone else's document. A separate product would be a second thing to secure, and a second thing to get wrong.` },
      { q: `Is it secure?`, a: `Every table has a rule that a record is only visible to the person who owns it, and the database enforces it — not my code remembering to check. Every page needs a login. The pages that cost money limit how often they can be called. Passwords for outside services stay on the server and never reach the browser.

Two gaps I'd rather name myself than have found: there's no content security policy yet, and the rate limit is counted in memory on a single machine, so it would need moving to shared storage before running on several.` },
      { q: `Why haven't you put it online?`, a: `I put the interview loop and the cost measurement first, and hosting is the part that can safely come last. The step-by-step instructions for putting it online are already written. It's a decision about order of work, not something I'm stuck on.` },
    ],
    talk: `What it's built from. Four parts.

The AI that asks and marks: a model from OpenAI called GPT-4o-mini. One model does all of it — asking, marking, writing feedback. Answers appear a word at a time rather than after a long pause.

Speech: a service from Microsoft called Azure Speech. It turns what you say into text while you're still talking, and reads the questions out in a natural voice. The password for that service never reaches the browser — the page asks my server for a short-lived pass instead.

Your documents: attach a job advert and it gets split into small pieces and stored so the system can search it by meaning rather than by exact words. So when it needs the part about required experience, it finds it even if that phrase was never used. Short documents skip the search and go in whole, because searching would cost more than it saves.

Storage: a database service called Supabase. Every record is locked to the person it belongs to, and the database enforces that rather than my code remembering to check.

That last point is the decision I'd defend hardest. The document search runs inside that same database, so it's covered by the same lock. A separate search product would have been a second place to get security right, and a second place to get it wrong.

On progress: every time I change the code, an automatic check runs the tests and builds the whole site. I haven't put it online yet — it runs on my machine against the real services.`,
  },
  {
    id: "s4",
    title: "What it costs to run",
    star: true,
    extra: "KEY SLIDE — the surprise result is the point, not an apology.",
    short: null,
    onSlide: "How AI billing works, what measuring let me cut, and the discount that turned out not to apply.",
    qa: [
      { q: `Explain the billing from the start.`, a: `AI services charge by the amount of text, not per request. Text is broken into "tokens", which are about four characters each — so roughly three-quarters of a word.

You pay for everything you send in: the instructions, the interviewer's personality, the conversation so far, any attached documents, and the candidate's answer. Then you pay again, at a higher rate, for everything the AI writes back. For the model I use it's about 15 cents per million tokens in and 60 cents per million out. Those rates sit in one file with the date I last checked them.` },
      { q: `Where do 1,024 and 590 come from? Did you choose them?`, a: `**1,024 is not mine.** OpenAI will reuse the opening part of your instructions and charge half price for it — but only if that part is at least 1,024 tokens long. That's their rule. I can't change it and I didn't pick it.

**590 is mine**, and it isn't one measurement — it's three things added up. 208 tokens I measured for the fixed instructions, roughly 325 for a typical interviewer personality, and a short line describing the scenario. So it's an approximation.` },
      { q: `If 590 is only approximate, how do you know the discount really doesn't apply?`, a: `Because I don't rely on the 590 for that. Every time the AI replies, it tells you how many tokens it reused. My code writes that number down for every single call.

On a session with no documents attached, that number is zero. Every time. So the estimate says "this should be too short to qualify" and the actual usage says "nothing was reused". They agree — and the zero is the real evidence. The 590 just explains why.` },
      { q: `Why not pad the instructions out to 1,024 and get the discount?`, a: `You'd be paying full price for about 430 tokens of padding on every single call, in order to get half price on the rest. It costs more than it saves.` },
      { q: `What does a session actually cost?`, a: `About a penny for a ten-question round. I'd call that an estimate rather than a measurement — it comes from adding up expected sizes, and I haven't yet run enough real sessions to replace it with an observed figure. It's exactly the sort of number I don't want to overstate.` },
      { q: `How do you know the prices are right?`, a: `They're in one file, with the date I checked them against OpenAI's public pricing page. If a model isn't listed, the tool reports the cost as unknown rather than as zero — so a missing price shows up as a gap instead of quietly making everything look cheaper than it is.` },
    ],
    talk: `This slide is about cost, because running an AI on every answer isn't free.

AI services charge by the amount of text, not per request. Rather than estimate that, I record every call the moment it happens, and a small tool adds it up and prices it. So when I tell you what a session costs, that's something I can look up in front of you rather than a figure I worked out on paper.

Once I could see where the money was going, some things were obvious to cut. If you type "ok", there's nothing to mark. Anything that's just counting — how many words, how often you hedged — is counted by ordinary code, because counting isn't judgement and the AI charges for it. And feedback that's already been written is reused rather than bought twice.

Then the result I didn't expect. OpenAI will charge half price for the opening part of your instructions if it's identical every time — but only once that part reaches one thousand and twenty-four tokens. That threshold is theirs, not mine. So I arranged my instructions with the unchanging part first, to qualify. Then I checked: mine comes to about five hundred and ninety. Too short. The discount never applies.

I kept the arrangement, because it costs nothing and it does start working once you attach a job advert — which is when there's enough text for it to matter. But the tool reports that it didn't apply, in plain words, rather than showing a saving I'm not getting.

So the claim isn't that this is cheap. It's that it's measured — including the improvement that turned out not to work.`,
  },
  {
    id: "s5",
    title: "Inside the marking",
    star: true,
    extra: "KEY SLIDE — the 5-versus-7 result is the thing to land.",
    short: null,
    onSlide: "What the marking checks, the rules that pick the next question, what you can change, and the result that proves the settings work.",
    qa: [
      { q: `Can the marking rules be changed from the app?`, a: `No. You set up the interview — the rounds, the interviewer, your documents. The numbers inside the marking are fixed in the code. Only two of your settings reach them at all: how strict and how warm the interviewer is.` },
      { q: `Isn't a fixed set of rules worse than letting the AI decide?`, a: `More flexible, probably. Easier to defend, definitely not.

Because it's ordinary code, I can tell you exactly which rule fired, show you that it fires the same way every time, and test each one on its own. If the AI decided, the answer to "why did it ask that?" would be "it just did".` },
      { q: `Have you tested the rules?`, a: `Yes. The rules, the counting, the skill matching and the interviewer generation all have tests. Altogether that's 482 tests across 55 files, and they run automatically every time I change the code, along with a type check and a full build of the site.` },
      { q: `Is the marking actually accurate?`, a: `I don't know yet, and I'd rather say that than guess.

I've built the thing that will tell me: 18 answers I wrote by hand covering all six kinds of round, each with the band I expect it to land in, and four things to measure — how often it lands in the right band, how much the same answer moves between runs, whether it separates good answers from bad ones, and how often it leaves parts of the checklist blank.

The design is finished. The run isn't. Each run costs money, and I wanted the design settled first so the first run is the real one.` },
      { q: `Does the interviewer's personality change the mark?`, a: `Not directly — the marking never sees who asked.

But it does indirectly, and I'd rather say it than be caught out by it: a friendlier interviewer asks easier questions, and easier questions get better answers. So you shouldn't compare marks from two different interviewers. The app says so on screen rather than hiding it.` },
      { q: `How does it avoid asking the same question twice?`, a: `Two ways. It's given the last ten questions it asked and told not to reuse them or reword them. And if the rules land on the same tactic twice in a row, it makes the next question harder instead of asking the same sort of thing again.` },
      { q: `What are the "skills you didn't cover"?`, a: `Twelve things interviews usually look for — handling conflict, dealing with failure, working when the goal is unclear, leadership, prioritising, and so on.

After each question, it compares that question against all twelve by meaning and ticks off the close ones. Any that haven't come up get suggested for the next question, and it rotates through them — otherwise every interview would open with the same two.` },
      { q: `What's the weakest part of this?`, a: `The round length you set is only a guide — it doesn't actually stop the round — and the countdown on each answer is a separate fixed number. Those two ought to be connected and aren't yet. I'd rather tell you than have you find it.` },
    ],
    talk: `Last slide: what's going on inside the marking and the question-picking, and what you get to change.

Marking first. There's a different checklist for each kind of round. For a "tell me about a time" question it checks whether you set the scene, said what you personally did, and said how it turned out. For a coding question, whether the answer is correct, whether it's efficient, and whether you handled the awkward cases. And the marking never knows who asked — a tough interviewer and a friendly one give the same answer the same mark, because your answer is worth what it's worth.

Picking the next question is a list of rules over that mark, and the first one that fits wins. No scene set, it asks you to start again with the background. Nothing concrete, it asks for specifics. You said "we", it asks what you did. Same tactic twice, it gets harder. It's also told what it has already asked, so it doesn't repeat itself.

Now, do the settings on the right actually do anything? Here's the result I'd like you to remember.

Take the same question and the same answer, and change nothing but the interviewer. A strict one aims at seven out of ten for the next question. A warm one aims at five. Same input, different interviewer, genuinely different follow-up.

And that isn't the AI being moody. It's a sum: your score sets a starting point, and the interviewer's strictness minus their warmth shifts it up or down. You could do it on paper and get those same two numbers every time.

That's the trade I made. You set up the interview — the rounds, the interviewer, your documents. You don't change the marking rules underneath; those are fixed numbers in the code. And fixing them is exactly why the same answer gets the same mark twice, and why I can test each rule on its own.`,
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
   What it is
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
  s.addText("Practise a job interview against an AI that marks every answer — and uses that mark to choose what to ask you next.", {
    x: M + 0.24, y: 1.34, w: CW - 0.5, h: 0.36,
    fontFace: SANS, fontSize: 16, color: BODY, valign: "middle",
  });
  s.addText(
    [
      { text: "Dylan Tan", options: { bold: true, color: INK } },
      { text: "   ·   Supervisor: «name»   ·   «date»", options: { color: MUTED } },
    ],
    { x: M + 0.24, y: 1.72, w: CW - 0.5, h: 0.26, fontFace: SANS, fontSize: 12, valign: "middle" },
  );

  panel(s, { x: M, y: 2.2, w: CW, h: 0.78, fill: ACCENT_SOFT, edge: ACCENT });
  s.addText(
    [
      { text: "A list of practice questions never notices what you said. A real person can't be there at 11pm. A chatbot won't mark you.   ", options: { color: BODY } },
      { text: "None of them connect how you answered to what you get asked next.", options: { bold: true, color: INK } },
    ],
    { x: M + 0.34, y: 2.2, w: CW - 0.6, h: 0.78, fontFace: SANS, fontSize: 13, valign: "middle", lineSpacing: 19 },
  );

  steps(s, [
    { tag: "STEP 1", title: "Say what you're preparing for", body: "Attach the real job advert and your resume" },
    { tag: "STEP 2", title: "Pick the rounds", body: "One, or a whole interview day" },
    { tag: "STEP 3", title: "Set the interviewer", body: "Background, and how tough they are" },
    { tag: "STEP 4", title: "Interview", body: "Then read the report" },
  ], { y: 3.14, h: 1.14 });

  const factW = (CW - 0.34 * 2) / 3;
  [
    {
      h: "Six kinds of round",
      rows: [
        "First interview, “tell me about a time”, HR",
        "Coding, system design, business case",
        "Each one is marked differently",
      ],
    },
    {
      h: "Type or speak",
      rows: [
        "Answers appear as they are written",
        "Or spoken aloud, and you reply by voice",
        "A code editor for coding rounds",
      ],
    },
    {
      h: "A report at the end",
      rows: [
        "A score, and feedback on every answer",
        "A stronger version of each answer",
        "Which skills you did and didn't cover",
      ],
    },
  ].forEach((c, i) => {
    const x = M + i * (factW + 0.34);
    panel(s, { x, y: 4.46, w: factW, h: 1.42, fill: PANEL, edge: ACCENT });
    s.addText(c.h, {
      x: x + 0.28, y: 4.58, w: factW - 0.46, h: 0.28,
      fontFace: SANS, fontSize: 13, bold: true, color: INK, valign: "middle",
    });
    s.addText(c.rows.map((r) => ({ text: r, options: { breakLine: true } })), {
      x: x + 0.28, y: 4.92, w: factW - 0.46, h: 0.86,
      fontFace: SANS, fontSize: 11, color: BODY, valign: "top", lineSpacing: 16,
    });
  });

  s.addNotes(TALK.s1);
  chrome(s);
}

/* =================================================================== SLIDE 2
   How it works  ★
   ========================================================================= */
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  head(s, "How it works", "It marks your answer, then uses that mark to choose the next question.");

  const steps4 = [
    { n: "1", t: "You answer", b: "typed or spoken" },
    { n: "2", t: "It marks the answer", b: "against a checklist for\nthis kind of question" },
    { n: "3", t: "It decides what to ask next", b: "and how hard\nto make it" },
    { n: "4", t: "It asks the follow-up", b: "aimed at what\nyou got wrong" },
  ];
  const gap = 0.3;
  const bw = (CW - gap * 3) / 4;
  steps4.forEach((b, i) => {
    const x = M + i * (bw + gap);
    const core = i === 1 || i === 2;
    s.addShape(pptx.ShapeType.rect, {
      x, y: 1.66, w: bw, h: 1.14,
      fill: { color: core ? ACCENT_SOFT : PANEL },
      line: { color: core ? ACCENT : LINE, width: core ? 1.25 : 1 },
    });
    s.addText(b.n, {
      x: x + 0.16, y: 1.74, w: 0.4, h: 0.26,
      fontFace: SANS, fontSize: 11, bold: true, color: ACCENT, valign: "middle",
    });
    s.addText(b.t, {
      x: x + 0.14, y: 1.99, w: bw - 0.28, h: 0.34,
      fontFace: SANS, fontSize: 13, bold: true, color: INK, align: "center", valign: "middle",
    });
    s.addText(b.b, {
      x: x + 0.1, y: 2.34, w: bw - 0.2, h: 0.44,
      fontFace: SANS, fontSize: 10.5, color: core ? ACCENT : MUTED,
      align: "center", valign: "top", lineSpacing: 13.5,
    });
    if (i < 3) {
      s.addText("▸", {
        x: x + bw, y: 2.11, w: gap, h: 0.32,
        fontFace: SANS, fontSize: 16, bold: true, color: ACCENT, align: "center", valign: "middle",
      });
    }
  });

  panel(s, { x: M, y: 2.9, w: CW, h: 0.46, fill: WHITE, edge: MUTED });
  s.addText(
    [
      { text: "Which checklist?  ", options: { bold: true, color: INK } },
      { text: "Story rounds — did you set the scene, was the task clear, what did ", options: { color: BODY } },
      { text: "you", options: { color: BODY, italic: true } },
      { text: " do, what was the result?      Technical rounds — did you understand the problem, is the answer correct, is it efficient, did you handle the tricky cases?", options: { color: BODY } },
    ],
    { x: M + 0.3, y: 2.9, w: CW - 0.5, h: 0.46, fontFace: SANS, fontSize: 10.5, valign: "middle" },
  );

  panel(s, { x: M, y: 3.46, w: CW, h: 1.94, fill: PANEL, edge: ACCENT });
  s.addText("A real example", {
    x: M + 0.34, y: 3.54, w: CW - 0.7, h: 0.28,
    fontFace: SANS, fontSize: 12.5, bold: true, color: ACCENT, valign: "middle",
  });
  s.addText(
    [
      { text: "Question   ", options: { bold: true, color: INK } },
      { text: "Tell me about a time you had to deliver a project with an unrealistic deadline.", options: { color: BODY, breakLine: true } },
      { text: "", options: { breakLine: true, fontSize: 5 } },
      { text: "Answer   ", options: { bold: true, color: INK } },
      { text: "“We had a launch date that was pretty tight. I worked with the team and we managed to get most of it done on time…”", options: { color: BODY, breakLine: true } },
      { text: "", options: { breakLine: true, fontSize: 5 } },
      { text: "It checks   ", options: { bold: true, color: INK } },
      { text: "Did you set the scene?  Are there any specifics?  Did you say what ", options: { color: BODY } },
      { text: "you", options: { color: BODY, italic: true } },
      { text: " did, or what the team did?", options: { color: BODY, breakLine: true } },
      { text: "", options: { breakLine: true, fontSize: 5 } },
      { text: "So next   ", options: { bold: true, color: ACCENT } },
      { text: "no specifics, and “we” all the way through — so the follow-up presses for what this person personally did.", options: { color: INK } },
    ],
    { x: M + 0.34, y: 3.86, w: CW - 0.7, h: 1.44, fontFace: SANS, fontSize: 11, valign: "top", lineSpacing: 16 },
  );

  panel(s, { x: M, y: 5.52, w: CW, h: 0.7, fill: ACCENT_SOFT, edge: ACCENT });
  s.addText(
    [
      { text: "Why mark it first?  ", options: { bold: true, color: ACCENT } },
      { text: "A score that only arrives at the end of the interview cannot change the interview.", options: { color: INK } },
    ],
    { x: M + 0.34, y: 5.52, w: CW - 0.6, h: 0.7, fontFace: SANS, fontSize: 13, valign: "middle" },
  );

  s.addText("Not an AI agent: the AI writes the questions and marks the answers. My code decides what happens next.", {
    x: M, y: 6.3, w: CW, h: 0.28,
    fontFace: SANS, fontSize: 10, italic: true, color: MUTED, valign: "middle",
  });

  s.addNotes(TALK.s2);
  chrome(s);
}

/* =================================================================== SLIDE 3
   What it's built from
   ========================================================================= */
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  head(s, "What it's built from", "Four parts, and what each one actually does.");

  const qw = (CW - 0.34) / 2;
  [
    {
      x: M, y: 1.74,
      h: "The AI that asks and marks",
      rows: [
        "GPT-4o-mini, from OpenAI",
        "One model asks the questions, marks the answers and writes the feedback",
        "Answers appear word by word, not after a long pause",
      ],
    },
    {
      x: M + qw + 0.34, y: 1.74,
      h: "Speech",
      rows: [
        "Azure Speech, from Microsoft",
        "Turns your voice into text while you are still talking",
        "Reads questions aloud in a natural voice — six to pick from",
      ],
    },
    {
      x: M, y: 3.46,
      h: "Your documents",
      rows: [
        "Attach the real job advert and your resume",
        "Split up and searched by meaning, so “led a team” finds “line management”",
        "Short documents skip the search and go in whole",
      ],
    },
    {
      x: M + qw + 0.34, y: 3.46,
      h: "Where everything is stored",
      rows: [
        "Supabase — a database service, hosted for me",
        "Every record is locked to the person it belongs to — the database enforces that, not my code",
        "The website itself is built with Next.js and React",
      ],
    },
  ].forEach((q) => {
    panel(s, { x: q.x, y: q.y, w: qw, h: 1.6, fill: PANEL, edge: ACCENT });
    s.addText(q.h, {
      x: q.x + 0.3, y: q.y + 0.12, w: qw - 0.5, h: 0.3,
      fontFace: SANS, fontSize: 13.5, bold: true, color: INK, valign: "middle",
    });
    s.addText(q.rows.map((r) => ({ text: r, options: { breakLine: true } })), {
      x: q.x + 0.3, y: q.y + 0.5, w: qw - 0.5, h: 0.98,
      fontFace: SANS, fontSize: 11.5, color: BODY, valign: "top", lineSpacing: 17,
    });
  });

  panel(s, { x: M, y: 5.18, w: CW, h: 0.66, fill: ACCENT_SOFT, edge: ACCENT });
  s.addText(
    [
      { text: "The decision I'd defend hardest:  ", options: { bold: true, color: ACCENT } },
      { text: "the document search lives inside the same database, so it is covered by the same lock. A separate search product would have been a second place to get security right — and a second place to get it wrong.", options: { color: INK } },
    ],
    { x: M + 0.34, y: 5.18, w: CW - 0.6, h: 0.66, fontFace: SANS, fontSize: 12, valign: "middle", lineSpacing: 16 },
  );

  panel(s, { x: M, y: 5.96, w: CW, h: 0.56, fill: PANEL });
  s.addText(
    [
      { text: "Checked on every change:  ", options: { bold: true, color: GREEN } },
      { text: "482 tests run, the code is checked, and the whole site is built.     ", options: { color: BODY } },
      { text: "Not yet done:  ", options: { bold: true, color: AMBER } },
      { text: "trying it with real users, checking how accurate the marking is, and putting it online.", options: { color: BODY } },
    ],
    { x: M + 0.3, y: 5.96, w: CW - 0.5, h: 0.56, fontFace: SANS, fontSize: 10.5, valign: "middle", lineSpacing: 14 },
  );

  s.addNotes(TALK.s3);
  chrome(s);
}

/* =================================================================== SLIDE 4
   What it costs  ★
   ========================================================================= */
{
  const s = pptx.addSlide();
  s.background = { color: WHITE };
  head(s, "What it costs to run", "Every AI call is recorded and priced, so the cost is measured — not guessed.");

  const cw3 = (CW - 0.34 * 2) / 3;
  [
    {
      h: "The AI bills by the text",
      b: "Text is counted in tokens — roughly four characters each. You pay for everything sent in, and again for everything written back, at different rates.",
    },
    {
      h: "So a session can be priced",
      b: "Every call writes down its own token count as it happens. A tool multiplies those by the published rates — so any cost figure is looked up, not guessed.",
    },
    {
      h: "What that let me cut",
      b: "One-word answers aren't marked · counting is done in ordinary code, not by the AI · feedback already written is reused, not bought twice",
    },
  ].forEach((c, i) => {
    const x = M + i * (cw3 + 0.34);
    panel(s, { x, y: 1.78, w: cw3, h: 1.44, fill: PANEL, edge: ACCENT });
    s.addText(c.h, {
      x: x + 0.28, y: 1.88, w: cw3 - 0.46, h: 0.28,
      fontFace: SANS, fontSize: 12.5, bold: true, color: INK, valign: "middle",
    });
    s.addText(c.b, {
      x: x + 0.28, y: 2.2, w: cw3 - 0.46, h: 0.92,
      fontFace: SANS, fontSize: 11, color: BODY, valign: "top", lineSpacing: 15.5,
    });
  });

  panel(s, { x: M, y: 3.42, w: CW, h: 1.86, fill: AMBER_SOFT, edge: AMBER });
  s.addText("The finding I didn't expect", {
    x: M + 0.34, y: 3.54, w: CW - 0.7, h: 0.32,
    fontFace: SANS, fontSize: 15, bold: true, color: AMBER, valign: "middle",
  });
  s.addText(
    "OpenAI halves the price of the opening chunk of your instructions if it is identical every time — but only once that chunk reaches 1,024 tokens. That threshold is theirs, not mine. So I arranged my instructions with the unchanging part first, to qualify. Then I checked: mine comes to about 590 tokens. Too short, so the discount never applies — and the report confirms it, because every reply tells you how many tokens were reused, and that count is zero.",
    { x: M + 0.34, y: 3.9, w: CW - 0.7, h: 0.76, fontFace: SANS, fontSize: 12.5, color: BODY, valign: "top", lineSpacing: 18 },
  );
  s.addText(
    "It does start applying once you attach a job advert, which is exactly when there is enough text for it to be worth having. Padding it out with filler to reach 1,024 would cost more than the discount returns.",
    { x: M + 0.34, y: 4.66, w: CW - 0.7, h: 0.5, fontFace: SANS, fontSize: 11, italic: true, color: MUTED, valign: "top", lineSpacing: 15 },
  );

  panel(s, { x: M, y: 5.44, w: CW, h: 0.84, fill: ACCENT_SOFT, edge: ACCENT });
  s.addText(
    [
      { text: "The claim isn't that it's cheap.  ", options: { bold: true, color: ACCENT } },
      { text: "It's that it's measured — including the optimisation that turned out not to work. A ten-question round costs roughly a penny, and even that is an estimate until I run the report on real traffic.", options: { color: INK } },
    ],
    { x: M + 0.34, y: 5.44, w: CW - 0.6, h: 0.84, fontFace: SANS, fontSize: 12.5, valign: "middle", lineSpacing: 17 },
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
  head(s, "Inside the marking", "How an answer is marked, how the next question is chosen, what you control.");

  const colW = (CW - 0.34 * 2) / 3;
  [
    {
      h: "How it marks your answer",
      edge: ACCENT,
      rows: [
        "A different checklist for each kind of round",
        "“Tell me about a time…” — did you set the scene, say what you did, say how it turned out?",
        "Coding — is it correct, is it efficient, does it handle the awkward cases?",
        "It never knows who asked. A tough and a friendly interviewer mark the same answer identically",
      ],
    },
    {
      h: "How it chooses the next question",
      edge: ACCENT,
      rows: [
        "No scene set  →  asks you to start again with the context",
        "Vague  →  presses for specifics",
        "You said “we”  →  asks what you did",
        "Same tactic twice  →  gets harder",
        "It is told what it has already asked, so it doesn't repeat itself",
      ],
    },
    {
      h: "What you can change",
      edge: GREEN,
      rows: [
        "The rounds — kind, length, focus, how many",
        "The interviewer — background, and how strict, warm, fast and challenging",
        "Type or speak, and which voice",
        "Your own job advert and resume",
      ],
    },
  ].forEach((c, i) => {
    const x = M + i * (colW + 0.34);
    panel(s, { x, y: 1.74, w: colW, h: 2.86, fill: PANEL, edge: c.edge });
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
      x: x + 0.28, y: 2.22, w: colW - 0.46, h: 2.28,
      fontFace: SANS, fontSize: 10.5, color: BODY, valign: "top", lineSpacing: 14.5,
    });
  });

  panel(s, { x: M, y: 4.72, w: CW, h: 0.84, fill: ACCENT_SOFT, edge: ACCENT });
  s.addText(
    [
      { text: "The settings really do change the interview.  ", options: { bold: true, color: ACCENT } },
      { text: "Same question, same answer — change only the interviewer. A strict one aims at 7 out of 10 for the next question; a warm one aims at 5. That is a formula, not the AI's mood: you can work it out on paper and get the same two numbers every run.", options: { color: INK } },
    ],
    { x: M + 0.34, y: 4.72, w: CW - 0.6, h: 0.84, fontFace: SANS, fontSize: 12.5, valign: "middle", lineSpacing: 17 },
  );

  panel(s, { x: M, y: 5.68, w: CW, h: 0.68, fill: AMBER_SOFT, edge: AMBER });
  s.addText(
    [
      { text: "What you cannot change:  ", options: { bold: true, color: AMBER } },
      { text: "the marking rules themselves. Those are fixed numbers in the code — and fixing them is exactly what makes the same answer get the same mark twice, and lets me test each rule on its own.", options: { color: INK } },
    ],
    { x: M + 0.34, y: 5.68, w: CW - 0.6, h: 0.68, fontFace: SANS, fontSize: 12, valign: "middle", lineSpacing: 16 },
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
        { lead: "The resume is read directly, not searched", rest: "short enough to fit whole, so splitting and indexing it would cost more than it saves. An earlier version boiled it down to a summary; that was removed so the interviewer reads what the candidate actually wrote" },
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

/* ------------------------------------- SCRIPT.md — section 1, the notebook */

{
  const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "SCRIPT.md");
  const md = [
    "# Section 1 — the slide-by-slide notebook",
    "",
    `**Five slides, ${TOTAL_WORDS} words of talk — about ${clock((TOTAL_WORDS / WPM) * 60)} at a rehearsed ${WPM} wpm**`,
    `(nearer ${clock((TOTAL_WORDS / 165) * 60)} if you speak quickly).`,
    "",
    "Each slide below has three parts: **what is on it**, **what to say**, and",
    "**if he asks** — the questions that slide invites, with the real answer and the",
    "numbers behind it. The \"what to say\" text is the same wording embedded as the",
    "speaker notes in the `.pptx`; both are generated from `build-deck.mjs`, so they",
    "cannot drift apart.",
    "",
    "**Slides 2, 4 and 5 carry the argument.** If you are running long, compress",
    "slide 1 and the closing half of slide 3.",
    "",
    "---",
    "",
  ];

  for (const s of SLIDES) {
    md.push(`## Slide ${s.id.slice(1)} · ${s.title} — \`${s.at}\`${s.star ? "  ★" : ""}`, "");
    if (s.onSlide) md.push(`**On the slide.** ${s.onSlide}`, "");

    md.push("### What to say", "");
    for (const para of wrap(s.talk, 76).split("\n\n")) {
      md.push(...para.split("\n").map((l) => "> " + l), ">");
    }
    md.pop();
    md.push("");
    if (s.short) md.push(`**If you are behind, the one-liner:** "${s.short}"`, "");

    if (s.qa && s.qa.length) {
      md.push("### If he asks", "");
      for (const item of s.qa) {
        md.push(`**"${item.q}"**`, "");
        for (const para of item.a.split("\n\n")) md.push(wrap(para, 78), "");
      }
    }
    md.push("---", "");
  }

  const cur = fs.readFileSync(SCRIPT, "utf8");
  const a = cur.indexOf("# Section 1");
  const b = cur.indexOf("# Section 2");
  if (a === -1 || b === -1) throw new Error("SCRIPT.md is missing its Section 1/2 markers");
  fs.writeFileSync(SCRIPT, cur.slice(0, a) + md.join("\n") + "\n" + cur.slice(b));
  const qaCount = SLIDES.reduce((n, s) => n + (s.qa ? s.qa.length : 0), 0);
  console.log("wrote", SCRIPT, `— ${TOTAL_WORDS} words, ${clock((TOTAL_WORDS / WPM) * 60)}, ${qaCount} anticipated questions`);
}
