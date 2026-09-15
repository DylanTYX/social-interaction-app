/**
 * The demo account's history, as rows ready to insert.
 *
 * A fresh account shows the analytics page's empty states: a chart needs four
 * scored sessions of a round type and a direction needs eight, and voice
 * delivery needs spoken answers. Building that live takes hours of interviews
 * and real API spend. This builds about five weeks of practice instead.
 *
 * **This is seeded data, and it must be presented as such.** docs/DEMO.md sets
 * the rules: say out loud that the account is seeded, never quote a number from
 * it as an evaluation result, and run one live interview on the account so the
 * system itself is shown working.
 *
 * What makes it worth looking at rather than lorem ipsum:
 *
 *   - Every answer is written text whose quality matches its score. A weak
 *     answer says "we" and "helped with" and gives no number; a strong one
 *     says what "I" did and what changed, by how much.
 *   - The numbers that code computes from text in the real product are
 *     computed here by the same functions from that same text: hedge and
 *     metric counts (`analyzeText`), evidence signals
 *     (`detectBehavioralSignals`), skill snapshots, session metrics, and voice
 *     delivery (`analyzeDelivery`, over synthetic phrase timings). Only the
 *     model's judgements are authored, and they are authored to agree with the
 *     text.
 *   - Rows follow the product's own write paths: message and turn numbering
 *     from `append_interview_turn`, titles from `briefTitle`, launch setup
 *     from `buildLaunchMetaFromSetup`, loop rounds as `next-round` writes them.
 *
 * Pure: the same `now` and ids give the same rows. Randomness is a seeded
 * generator, so a re-seed tells the same story.
 */

import type {
  InterviewRoundConfig,
  InterviewRoundType,
} from "@/lib/interview-rounds";
import {
  buildRoundScenarioDescription,
  buildRoundScenarioTitle,
} from "@/lib/interview-rounds";
import { buildInterviewMetrics } from "@/lib/interview-metrics";
import {
  createInterviewSessionState,
  recordInterviewTurn,
} from "@/lib/interview-session-state";
import { createDefaultInterviewSetup } from "@/lib/interview-setup";
import { PRESET_PERSONAS, type PersonaConfig } from "@/lib/persona-engine";
import type {
  AnalysisResult,
  InterviewStrategy,
} from "@/lib/response-analyzer";
import { ROUND_TYPE_SPECS, isTechnicalRound } from "@/lib/round-types";
import { briefTitle } from "@/lib/scenarios";
import {
  buildLaunchMetaFromSetup,
  deliverySnapshotFromMetrics,
  dimensionSnapshotFromAnalysis,
  type DeliverySnapshot,
  type LoopProgress,
} from "@/lib/session-launch-meta";
import { analyzeDelivery, type PhraseTiming } from "@/lib/speech-metrics";
import { analyzeText, detectBehavioralSignals } from "@/lib/text-metrics";

export const DEMO_CANDIDATE_NAME = "Alex Tan";

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

type Tier = "weak" | "ok" | "strong";

function tierFor(score: number): Tier {
  return score < 60 ? "weak" : score < 70 ? "ok" : "strong";
}

interface Story {
  competencies: string[];
  question: string;
  situation: string;
  taskWe: string;
  taskI: string;
  actionVague: string;
  actionSpecific: string;
  resultVague: string;
  resultQuantified: string;
  reflection: string;
  followUp: string;
  followUpWeak: string;
  followUpStrong: string;
}

const STORIES: Story[] = [
  {
    competencies: ["conflict", "collaboration"],
    question:
      "Tell me about a time you disagreed with a teammate about how to approach a problem.",
    situation:
      "During my internship at a payments startup, a teammate and I disagreed about the retry logic for failed card payments.",
    taskWe:
      "We were involved in deciding whether to rewrite it or patch it before the release.",
    taskI:
      "I owned the retry service that sprint, so the call on how to fix it was mine to make.",
    actionVague:
      "We talked about it a lot and the team decided to patch it first, and I helped with the testing.",
    actionSpecific:
      "I wrote a one-page comparison of both options with the risks and the time each would take, then walked my teammate and our lead through it and proposed patching now and rewriting next sprint.",
    resultVague: "It worked out and the release went fine.",
    resultQuantified:
      "We shipped on time, failed retries dropped from about 4% to under 1%, and the rewrite landed two weeks later.",
    reflection:
      "Next time I would bring the written comparison before the disagreement got heated, not after.",
    followUp: "You mentioned the decision. What exactly was your part in it?",
    followUpWeak:
      "I was part of the discussions and I helped with testing the patch once it was decided.",
    followUpStrong:
      "I proposed the patch-first plan and wrote the comparison that made the tradeoff visible. My teammate still preferred the rewrite, so I scheduled it for the next sprint with his design.",
  },
  {
    competencies: ["failure", "ownership"],
    question: "Tell me about a project that did not go the way you planned.",
    situation:
      "In my final-year capstone, our demo to the industry sponsor broke because a database migration failed the night before.",
    taskWe: "We had to get the demo working again somehow.",
    taskI:
      "I had written that migration, so getting us back to a working demo was on me.",
    actionVague:
      "We worked late and managed to fix things, and I contributed to getting the database back.",
    actionSpecific:
      "I rolled back to the last good snapshot, replayed the migration on a copy to find the column that broke, fixed it, and added a migration test to our CI so it could not happen silently again.",
    resultVague: "The demo was okay in the end.",
    resultQuantified:
      "The demo ran the next morning with 20 minutes to spare, and the migration test caught two more bad migrations before the project ended.",
    reflection:
      "I now test every migration against a copy of real data before it touches a shared database.",
    followUp: "What did you change afterwards because of it?",
    followUpWeak: "I learned to be more careful with databases in the future.",
    followUpStrong:
      "I added a CI step that runs every migration against a snapshot of the demo data, and I wrote a short rollback checklist the team used for the rest of the project.",
  },
  {
    competencies: ["ownership", "leadership"],
    question:
      "Give me an example of a time you took ownership of something nobody else was handling.",
    situation:
      "Our team's test suite had become flaky, and about one build in five failed for no real reason.",
    taskWe: "We all knew it was a problem but it was nobody's job.",
    taskI:
      "Nobody owned it, and it was slowing my own work every day, so I decided to take it on.",
    actionVague:
      "I was involved in looking at the tests and we fixed some of them.",
    actionSpecific:
      "I tracked every failed build for a week, found that three tests shared a clock and a port, isolated them, and posted a short write-up so everyone knew what had changed.",
    resultVague: "Things got a lot better after that.",
    resultQuantified:
      "False failures went from roughly one build in five to about one in fifty, which saved the team around two hours of re-runs a week.",
    reflection:
      "It taught me that a small, visible fix can build more trust than a big proposal.",
    followUp: "How did you get the rest of the team to adopt the fix?",
    followUpWeak: "We just started using it and people were happy with it.",
    followUpStrong:
      "I paired with the two engineers whose tests were affected, so they understood the change, and I added a lint rule that flags shared ports in new tests.",
  },
  {
    competencies: ["prioritisation", "ambiguity"],
    question:
      "Tell me about a time you had too much to do and had to decide what to drop.",
    situation:
      "In a two-week hackathon, our team planned five features for a volunteer scheduling app and fell behind in the first week.",
    taskWe: "We needed to figure out what to do with the time left.",
    taskI:
      "As the person keeping our board, I had to recommend what we would actually finish.",
    actionVague: "We had a discussion and the team decided to cut some things.",
    actionSpecific:
      "I asked three volunteers which problem hurt most, ranked the features by that, and proposed cutting two of them so we could finish shift swapping properly.",
    resultVague: "We ended up with a decent project.",
    resultQuantified:
      "We shipped three working features instead of five half-built ones, placed second of 14 teams, and the volunteer group kept using the shift-swap feature afterwards.",
    reflection:
      "I learned to cut scope early and on evidence, rather than late and in a panic.",
    followUp: "How did you decide which features to cut?",
    followUpWeak: "We kind of just picked the ones that seemed less important.",
    followUpStrong:
      "I scored each feature by how often volunteers mentioned the problem and how long it would take, and cut the two with the lowest ratio. I shared the scores so the team could challenge them.",
  },
  {
    competencies: ["collaboration", "communication"],
    question:
      "Describe a time you worked closely with people outside your own discipline.",
    situation:
      "For a campus app, I worked with two design students who had very different ideas from our engineering team about the sign-up flow.",
    taskWe: "We had to get everyone on the same page.",
    taskI:
      "I was the engineer the designers worked with directly, so I had to turn their designs into something we could build in time.",
    actionVague:
      "We had meetings and eventually came to an agreement on the design.",
    actionSpecific:
      "I built a clickable prototype of both flows in a day, ran a quick test with six students, and shared the recordings so the decision rested on what people actually did.",
    resultVague: "The final design was good.",
    resultQuantified:
      "Sign-up completion in the test went from four of six students to six of six, and we launched with the designers' flow plus one change from engineering.",
    reflection:
      "Showing people something they can click settles disagreements faster than arguing about it.",
    followUp: "What did you do when you disagreed with the designers?",
    followUpWeak:
      "I mostly went along with what they wanted because they were the designers.",
    followUpStrong:
      "I explained which part would take longest to build and offered a cheaper version with the same behaviour. They accepted it for launch and we kept their original for later.",
  },
  {
    competencies: ["feedback", "communication"],
    question:
      "Tell me about a time you received critical feedback on your work.",
    situation:
      "On my first large pull request at my internship, a senior engineer left 30 comments saying the change was too big to review.",
    taskWe: "We needed to get the change merged.",
    taskI:
      "It was my change, so I had to decide how to respond and still hit the sprint goal.",
    actionVague:
      "I took the feedback on board and made some changes to the code.",
    actionSpecific:
      "I asked him for 15 minutes to understand the main concern, split the change into four smaller pull requests with a short description each, and got the first one merged the same day.",
    resultVague: "It got merged eventually and he was happy.",
    resultQuantified:
      "All four merged within three days, review time on my later pull requests dropped from about two days to under half a day, and he started asking me to review others' changes.",
    reflection: "I now plan the review before I write the code, not after.",
    followUp: "How did that feedback change the way you work?",
    followUpWeak: "I try to make my pull requests smaller now.",
    followUpStrong:
      "I sketch the pull requests before I start, keep each under about 300 lines, and write the description first so I know the change has one purpose.",
  },
];

interface TechnicalProblem {
  question: string;
  weak: string;
  ok: string;
  strong: string;
  followUp: string;
  followUpWeak: string;
  followUpStrong: string;
}

const TECHNICAL: TechnicalProblem[] = [
  {
    question:
      "Given a list of meeting time intervals, merge all overlapping intervals. Talk me through your approach.",
    weak: "I would loop through the intervals and merge the ones that overlap. It should work for most cases.\n\n```python\ndef merge(xs):\n    out = []\n    for a, b in xs:\n        if out and a <= out[-1][1]:\n            out[-1][1] = b\n        else:\n            out.append([a, b])\n    return out\n```",
    ok: "First I would sort by start time, then walk through and extend the last interval when the next one starts before it ends. Sorting is O(n log n).\n\n```python\ndef merge(xs):\n    xs.sort()\n    out = []\n    for a, b in xs:\n        if out and a <= out[-1][1]:\n            out[-1][1] = max(out[-1][1], b)\n        else:\n            out.append([a, b])\n    return out\n```",
    strong:
      "Let me restate it: intervals may be unsorted and may touch at the edges, and touching counts as overlapping. I will sort by start, then keep extending the last merged interval with max of the ends, because a later interval can end before an earlier one. Time is O(n log n) for the sort and O(n) extra space for the output. Edge cases are an empty list, one interval, and intervals fully inside another.\n\n```python\ndef merge(intervals):\n    if not intervals:\n        return []\n    intervals.sort(key=lambda x: x[0])\n    merged = [list(intervals[0])]\n    for start, end in intervals[1:]:\n        if start <= merged[-1][1]:\n            merged[-1][1] = max(merged[-1][1], end)\n        else:\n            merged.append([start, end])\n    return merged\n```",
    followUp: "What happens if one interval sits entirely inside another?",
    followUpWeak: "I think it would still merge them fine.",
    followUpStrong:
      "That is why I take the max of the two ends. Without it, an inner interval would shrink the merged one. For [1, 10] then [2, 3], the result stays [1, 10].",
  },
  {
    question: "How would you detect whether a linked list has a cycle?",
    weak: "I would keep going through the list and if I see the same node again there is a cycle.",
    ok: "I can store visited nodes in a set and return true if I see one again. That is O(n) time and O(n) space.",
    strong:
      "Two options. A hash set of visited nodes is O(n) time and O(n) space. Floyd's two pointers get O(1) space: a slow pointer moves one step and a fast pointer two, and if they ever meet there is a cycle, because the fast one gains a node per step inside the loop. I would use two pointers. Edge cases are an empty list and a single node pointing to itself.",
    followUp: "How would you find where the cycle starts?",
    followUpWeak: "Maybe by checking which node repeats first.",
    followUpStrong:
      "After they meet, move one pointer back to the head and step both one node at a time. They meet again at the start of the cycle, because the distance from the head equals the distance from the meeting point around the loop.",
  },
  {
    question:
      "Design an LRU cache with get and put in constant time. Walk me through the data structures.",
    weak: "I would use a dictionary to store the values and remove old ones when it gets full.",
    ok: "A dictionary gives O(1) lookup, and I need to know the least recently used key, so I would keep a doubly linked list of keys and move a key to the front when it is used.",
    strong:
      "I need O(1) lookup and O(1) recency updates, so a hash map from key to node plus a doubly linked list ordered by recency. get moves the node to the head; put inserts at the head and, when over capacity, removes the tail and deletes its key from the map. Both are O(1). Edge cases are capacity zero, putting an existing key, which must update and move it, and getting a missing key.",
    followUp: "Why a doubly linked list rather than a singly linked one?",
    followUpWeak: "Because it is faster I think.",
    followUpStrong:
      "Removing a node from the middle needs its previous node. A doubly linked list gives that in O(1); a singly linked one would need a walk from the head, which breaks the constant-time guarantee.",
  },
  {
    question: "Check whether a binary tree is a valid binary search tree.",
    weak: "I would check that every left child is smaller than its parent and every right child is bigger.",
    ok: "I would do an in-order traversal and check the values come out strictly increasing. That is O(n) time.",
    strong:
      "Checking only parent and child is a common bug, because a node deep on the left must still be less than the root. I will pass a lower and upper bound down the recursion and narrow them at each step. That is O(n) time and O(h) space for the recursion. Edge cases: an empty tree is valid, duplicates depend on the definition, and a very deep tree could hit the recursion limit, so I would go iterative in production.",
    followUp: "How would you handle duplicates?",
    followUpWeak: "I would just allow them.",
    followUpStrong:
      "It depends on the tree's definition. If duplicates go right, the right bound becomes inclusive. I would ask, and then make the comparison match that rule on both sides.",
  },
];

const SCREENING_QUESTIONS: Array<{
  question: string;
  weak: string;
  strong: string;
}> = [
  {
    question: "Walk me through your background in a couple of minutes.",
    weak: "I'm a final-year computer science student. I've done some projects and an internship, and I like coding.",
    strong:
      "I'm finishing a computer science degree, with a focus on backend systems. Last summer I interned at a payments startup, where I owned the card retry service and cut failed retries from about 4% to under 1%. My capstone was a scheduling app for a volunteer group that is still in use. I'm looking for a graduate backend role where reliability matters.",
  },
  {
    question: "Why are you interested in this role?",
    weak: "It seems like a good company and I think I would learn a lot there.",
    strong:
      "Two reasons. The role is on the payments platform, which is the work I enjoyed most in my internship, and your engineering blog's post on idempotent retries described exactly the problem I worked on. I want to go deeper on that with people who have solved it at scale.",
  },
  {
    question: "What are you looking for in your next team?",
    weak: "A friendly team where I can grow.",
    strong:
      "Code review that is taken seriously, because the feedback I got on my first big pull request changed how I work. I also want ownership of a real service early, even a small one, so I can see my changes in production.",
  },
];

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

type PersonaKey = keyof typeof PRESET_PERSONAS;

interface PlannedSession {
  type: InterviewRoundType;
  daysAgo: number;
  hour: number;
  score: number;
  persona: PersonaKey;
  voice: boolean;
  answers: number;
  status?: "completed" | "abandoned";
  title?: string;
  tags?: string[];
  pinned?: boolean;
  archived?: boolean;
  withResume?: boolean;
  loop?: { group: string; index: number };
}

/**
 * Five weeks of practice. Behavioural scores climb with dips where the
 * interviewer was demanding (Aisyah Rahman), so the analytics caveat about
 * tougher interviewers has something real to point at. Technical stops at six
 * sessions, short of the eight needed for a direction, so the page's honesty
 * about thin data is visible too. Voice sessions start fast and filler-heavy
 * and settle, so the delivery comparison has a story.
 */
const PLAN: PlannedSession[] = [
  {
    type: "screening",
    daysAgo: 34,
    hour: 19,
    score: 66,
    persona: "isabella rodriguez",
    voice: false,
    answers: 3,
    archived: true,
  },
  {
    type: "behavioral",
    daysAgo: 33,
    hour: 20,
    score: 54,
    persona: "priya sharma",
    voice: false,
    answers: 5,
  },
  {
    type: "behavioral",
    daysAgo: 31,
    hour: 19,
    score: 57,
    persona: "marcus johnson",
    voice: true,
    answers: 5,
  },
  {
    type: "technical_swe",
    daysAgo: 30,
    hour: 21,
    score: 49,
    persona: "sarah chen",
    voice: false,
    answers: 4,
  },
  {
    type: "behavioral",
    daysAgo: 28,
    hour: 18,
    score: 55,
    persona: "aisyah rahman",
    voice: false,
    answers: 5,
  },
  {
    type: "behavioral",
    daysAgo: 26,
    hour: 20,
    score: 60,
    persona: "priya sharma",
    voice: true,
    answers: 5,
  },
  {
    type: "technical_swe",
    daysAgo: 24,
    hour: 21,
    score: 53,
    persona: "lars petersen",
    voice: false,
    answers: 4,
  },
  {
    type: "behavioral",
    daysAgo: 22,
    hour: 19,
    score: 62,
    persona: "marcus johnson",
    voice: false,
    answers: 5,
    withResume: true,
  },
  {
    type: "screening",
    daysAgo: 20,
    hour: 12,
    score: 71,
    persona: "marcus johnson",
    voice: true,
    answers: 3,
    withResume: true,
  },
  {
    type: "behavioral",
    daysAgo: 19,
    hour: 20,
    score: 58,
    persona: "aisyah rahman",
    voice: true,
    answers: 5,
    withResume: true,
  },
  {
    type: "technical_swe",
    daysAgo: 17,
    hour: 21,
    score: 58,
    persona: "sarah chen",
    voice: false,
    answers: 4,
    withResume: true,
  },
  {
    type: "behavioral",
    daysAgo: 15,
    hour: 13,
    score: 61,
    persona: "priya sharma",
    voice: false,
    answers: 2,
    status: "abandoned",
  },
  {
    type: "behavioral",
    daysAgo: 14,
    hour: 19,
    score: 65,
    persona: "priya sharma",
    voice: false,
    answers: 5,
    withResume: true,
  },
  {
    type: "behavioral",
    daysAgo: 11,
    hour: 20,
    score: 67,
    persona: "marcus johnson",
    voice: true,
    answers: 5,
    withResume: true,
  },
  {
    type: "screening",
    daysAgo: 12,
    hour: 12,
    score: 73,
    persona: "isabella rodriguez",
    voice: false,
    answers: 3,
    withResume: true,
  },
  {
    type: "technical_swe",
    daysAgo: 10,
    hour: 21,
    score: 61,
    persona: "lars petersen",
    voice: false,
    answers: 4,
    withResume: true,
  },
  {
    type: "behavioral",
    daysAgo: 8,
    hour: 18,
    score: 63,
    persona: "aisyah rahman",
    voice: false,
    answers: 5,
    withResume: true,
  },
  // A three-round loop on one morning, as a real interview day runs.
  {
    type: "screening",
    daysAgo: 6,
    hour: 10,
    score: 76,
    persona: "marcus johnson",
    voice: true,
    answers: 3,
    withResume: true,
    loop: { group: "day", index: 0 },
    tags: ["Northwind Pay", "final round"],
  },
  {
    type: "behavioral",
    daysAgo: 6,
    hour: 11,
    score: 70,
    persona: "priya sharma",
    voice: true,
    answers: 5,
    withResume: true,
    loop: { group: "day", index: 1 },
    tags: ["Northwind Pay", "final round"],
  },
  {
    type: "technical_swe",
    daysAgo: 6,
    hour: 12,
    score: 64,
    persona: "lars petersen",
    voice: false,
    answers: 4,
    withResume: true,
    loop: { group: "day", index: 2 },
    tags: ["Northwind Pay", "final round"],
  },
  {
    type: "behavioral",
    daysAgo: 4,
    hour: 20,
    score: 72,
    persona: "marcus johnson",
    voice: true,
    answers: 5,
    withResume: true,
    title: "Northwind Pay final round rehearsal",
    pinned: true,
    tags: ["Northwind Pay"],
  },
  {
    type: "technical_swe",
    daysAgo: 2,
    hour: 21,
    score: 66,
    persona: "sarah chen",
    voice: false,
    answers: 4,
    withResume: true,
  },
  {
    type: "behavioral",
    daysAgo: 1,
    hour: 19,
    score: 74,
    persona: "priya sharma",
    voice: true,
    answers: 5,
    withResume: true,
  },
];

const BRIEFS: Record<string, string> = {
  behavioral:
    "Behavioural practice for a graduate backend engineer role at a payments company, focusing on ownership and measurable results.",
  technical_swe:
    "Coding practice for a graduate software engineer interview: arrays, linked lists and trees, explained out loud.",
  screening:
    "Recruiter screen for a graduate backend engineer role at Northwind Pay.",
  loop: "Northwind Pay graduate backend engineer interview day",
};

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export interface DemoMessageRow {
  role: "user" | "assistant";
  content: string;
  turn_index: number;
  created_at: string;
}

export interface DemoAnalysisRow {
  turn_index: number;
  round_type: InterviewRoundType;
  overall_score: number;
  strategy: InterviewStrategy;
  confidence: number;
  analysis: AnalysisResult;
}

export interface DemoSession {
  id: string;
  /** Rows the runner fills in: `user_id`, and `resume_id` when `withResume`. */
  withResume: boolean;
  loop: { group: string; index: number } | null;
  row: Record<string, unknown>;
  messages: DemoMessageRow[];
  analyses: DemoAnalysisRow[];
}

export interface DemoDataset {
  resume: {
    id: string;
    title: string;
    variant: string;
    raw_text: string;
  };
  sessions: DemoSession[];
}

export const DEMO_RESUME_TEXT = `Alex Tan
Final-year BSc Computer Science

EXPERIENCE
Software Engineering Intern, Payments startup (May to Aug)
- Owned the card payment retry service; cut failed retries from about 4% to under 1%.
- Split a large refactor into four reviewable pull requests; review time fell from two days to half a day.
- Fixed a flaky test suite (1 in 5 builds failing) by isolating shared clocks and ports.

PROJECTS
Volunteer scheduling app (capstone): shift swapping used weekly by a volunteer group.
Hackathon: placed 2nd of 14 teams.

SKILLS
Python, TypeScript, PostgreSQL, Docker, CI/CD`;

function isoAt(now: Date, daysAgo: number, hour: number, minute = 0): string {
  const date = new Date(now.getTime());
  date.setUTCDate(date.getUTCDate() - daysAgo);
  date.setUTCHours(hour, minute, 0, 0);
  return date.toISOString();
}

function addSeconds(iso: string, seconds: number): string {
  return new Date(Date.parse(iso) + seconds * 1000).toISOString();
}

function roundConfig(
  type: InterviewRoundType,
  voice: boolean,
  id: string,
): InterviewRoundConfig {
  const spec = ROUND_TYPE_SPECS[type];
  return {
    id,
    title: spec.label,
    type,
    durationMinutes: spec.defaults.durationMinutes,
    practiceMode: voice ? "voice" : "text",
    focus: spec.defaults.focus,
  };
}

/** Sprinkle filler words into a spoken answer, the way nerves do. */
function withFillers(
  text: string,
  count: number,
  random: () => number,
): string {
  if (count <= 0) return text;
  const fillers = ["um,", "uh,", "you know,", "um,", "sort of", "I mean,"];
  const words = text.split(" ");
  for (let i = 0; i < count; i += 1) {
    const at = 1 + Math.floor(random() * Math.max(1, words.length - 2));
    words.splice(at, 0, fillers[Math.floor(random() * fillers.length)]);
  }
  return words.join(" ");
}

/**
 * Phrase timings for a spoken answer at a given pace, with long gaps where
 * the speaker paused. `analyzeDelivery` reads these exactly as it reads the
 * recognizer's.
 */
function phraseTimings(
  transcript: string,
  wpm: number,
  longPauses: number,
): PhraseTiming[] {
  const sentences = transcript
    .replace(/```[\s\S]*?```/g, " ")
    .split(/(?<=[.?!])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const phrases: PhraseTiming[] = [];
  let offset = 0.5;
  sentences.forEach((sentence, index) => {
    const words = sentence.split(/\s+/).length;
    const duration = (words / wpm) * 60;
    phrases.push({
      text: sentence,
      offsetSeconds: offset,
      durationSeconds: duration,
    });
    const pause = index > 0 && index <= longPauses ? 1.9 : 0.35;
    offset += duration + pause;
  });
  return phrases;
}

function authoredAnalysis(input: {
  type: InterviewRoundType;
  score: number;
  answer: string;
  random: () => number;
  storyGap: { gap: string; strength: string; followup: string };
}): AnalysisResult {
  const { type, score, answer, random } = input;
  const tier = tierFor(score);
  const counted = analyzeText(answer);
  const jitter = () => (random() - 0.5) * 1.2;
  const base = score / 10;

  const star = {
    situation: {
      present: true,
      quality: round1(clamp(base + 1 + jitter(), 0, 10)),
      context: "Context is set in a sentence.",
    },
    task: {
      present: true,
      quality: round1(clamp(base + 0.4 + jitter(), 0, 10)),
      clarity:
        tier === "weak"
          ? "Shared task; personal role unclear."
          : "Own responsibility stated.",
    },
    action: {
      present: true,
      quality: round1(
        clamp(base + (tier === "weak" ? -0.6 : 0.3) + jitter(), 0, 10),
      ),
      specificity: tier === "weak" ? 3 : tier === "ok" ? 6 : 8,
      ownership: tier === "weak" ? 3 : tier === "ok" ? 6 : 8,
      summary:
        tier === "weak"
          ? "Team activity described."
          : "Specific personal steps described.",
    },
    result: {
      // The weakest part, as it is for most candidates: early answers end on
      // "it went fine", later ones on a number.
      present: tier !== "weak" || random() > 0.35,
      quality: round1(
        clamp(base - (tier === "strong" ? 0.4 : 1.6) + jitter(), 0, 10),
      ),
      quantified: tier === "strong",
      impact:
        tier === "strong"
          ? "Measured outcome given."
          : "Outcome stated without a measure.",
    },
  };

  const technical = isTechnicalRound(type)
    ? {
        problemFraming: round1(
          clamp(base + (tier === "strong" ? 0.8 : -0.4) + jitter(), 0, 10),
        ),
        approach: round1(clamp(base + 0.6 + jitter(), 0, 10)),
        correctness: round1(clamp(base + 0.4 + jitter(), 0, 10)),
        complexity: round1(
          clamp(base - (tier === "weak" ? 1.4 : 0.2) + jitter(), 0, 10),
        ),
        communication: round1(clamp(base + 0.5 + jitter(), 0, 10)),
        // The one that stays weakest: edge cases are named late or not at all.
        edgeCases: round1(
          clamp(base - (tier === "strong" ? 0.6 : 1.8) + jitter(), 0, 10),
        ),
        codeQuality: round1(clamp(base + 0.2 + jitter(), 0, 10)),
      }
    : undefined;

  return {
    overallScore: score,
    roundType: type,
    starAnalysis: star,
    technicalScores: technical,
    specificityMetrics: {
      hasMetrics: counted.hasMetrics,
      metricCount: counted.metricCount,
      hasTimeframes: counted.hasTimeframes,
      hasStakeholders: tier !== "weak",
      vaguenessScore: tier === "weak" ? 7 : tier === "ok" ? 4 : 2,
      concreteExamples:
        tier === "weak" ? (random() > 0.5 ? 0 : 1) : tier === "ok" ? 1 : 2,
    },
    confidenceIndicators: {
      hesitationMarkers: counted.hesitationMarkers,
      assertivenessScore: tier === "weak" ? 5 : tier === "ok" ? 6.5 : 8,
      clarity: tier === "weak" ? 5 : tier === "ok" ? 7 : 8.5,
      qualificationCount: counted.qualificationCount,
      revisionsCount: counted.revisionsCount,
    },
    responseQuality: {
      length: counted.wordCount,
      isRelevant: true,
      addressesExplicitly: tier !== "weak" || random() > 0.3,
      depthLevel:
        tier === "weak" ? "surface" : tier === "ok" ? "moderate" : "deep",
      thinkingVisible: tier !== "weak",
    },
    languageSignals: detectBehavioralSignals(answer),
    strengths: tier === "weak" ? [] : [input.storyGap.strength],
    gaps: tier === "strong" ? [] : [input.storyGap.gap],
    followupTopics: [input.storyGap.followup],
    omittedFields: [],
  };
}

function strategyFor(type: InterviewRoundType, tier: Tier): InterviewStrategy {
  if (isTechnicalRound(type)) {
    return tier === "weak"
      ? "PROBE_ACTION"
      : tier === "ok"
        ? "ASSESS_THINKING"
        : "HYPOTHETICAL_TWIST";
  }
  return tier === "weak"
    ? "CHALLENGE_OWNERSHIP"
    : tier === "ok"
      ? "EXPLORE_RESULT"
      : "ACKNOWLEDGE_STRENGTH";
}

const GAPS_BEHAVIOURAL = {
  weak: "Your own role is hard to separate from what the team did.",
  ok: "The result is described but never measured.",
};
const GAPS_TECHNICAL = {
  weak: "Jumped to code without stating complexity or edge cases.",
  ok: "Edge cases were only named when prompted.",
};

export function buildDemoDataset(options: {
  now: Date;
  newId: () => string;
}): DemoDataset {
  const { now, newId } = options;
  const random = mulberry32(20260915);

  const resume = {
    id: newId(),
    title: "Alex Tan, backend",
    variant: "Graduate backend roles",
    raw_text: DEMO_RESUME_TEXT,
  };

  const loopRounds = new Map<string, InterviewRoundConfig[]>();
  for (const plan of PLAN) {
    if (!plan.loop) continue;
    const rounds = loopRounds.get(plan.loop.group) ?? [];
    rounds[plan.loop.index] = roundConfig(
      plan.type,
      plan.voice,
      `loop-round-${plan.loop.index + 1}`,
    );
    loopRounds.set(plan.loop.group, rounds);
  }

  let storyCursor = 0;
  let technicalCursor = 0;
  let screeningCursor = 0;
  let voiceIndex = 0;
  const voiceSessionsTotal = PLAN.filter((plan) => plan.voice).length;

  const sessions = PLAN.map((plan): DemoSession => {
    const id = newId();
    const persona: PersonaConfig = { ...PRESET_PERSONAS[plan.persona] };
    const startedAt = isoAt(
      now,
      plan.daysAgo,
      plan.hour,
      Math.floor(random() * 40),
    );
    const rounds = plan.loop
      ? loopRounds.get(plan.loop.group)!
      : [roundConfig(plan.type, plan.voice, `single-${plan.type}`)];
    const loop = {
      enabled: Boolean(plan.loop),
      templateId: plan.loop ? "custom" : "single",
      breakMinutes: 5,
      currentRoundIndex: plan.loop?.index ?? 0,
      rounds,
    };
    const brief = plan.loop ? BRIEFS.loop : BRIEFS[plan.type];

    const setup = createDefaultInterviewSetup();
    setup.scenarioValue = "custom";
    setup.customScenarioBrief = brief;
    setup.personaConfig = persona;
    setup.practiceMode = plan.voice ? "voice" : "text";
    setup.interviewLoop = loop;
    setup.resume = plan.withResume
      ? {
          enabled: true,
          mode: "saved",
          rawText: "",
          savedId: resume.id,
          savedTitle: resume.title,
        }
      : setup.resume;
    const launchMeta = buildLaunchMetaFromSetup(setup);

    // Pace and fillers settle across the voice sessions, oldest to newest.
    const voiceProgress = plan.voice
      ? voiceIndex / Math.max(1, voiceSessionsTotal - 1)
      : 0;
    if (plan.voice) voiceIndex += 1;
    const sessionWpm = Math.round(194 - voiceProgress * 42);

    const messages: DemoMessageRow[] = [];
    const analyses: DemoAnalysisRow[] = [];
    const deliverySnapshots: DeliverySnapshot[] = [];
    const covered: Record<string, number> = {};
    let clock = startedAt;
    let turn = 1;

    // Questions for this session.
    const turns: Array<{
      question: string;
      answerFor: (tier: Tier) => string;
      gap: { gap: string; strength: string; followup: string };
    }> = [];
    if (plan.type === "behavioral") {
      while (turns.length < plan.answers) {
        const story = STORIES[storyCursor % STORIES.length];
        storyCursor += 1;
        story.competencies.forEach((competency) => {
          covered[competency] = round1(0.45 + random() * 0.3);
        });
        const gap = {
          gap: GAPS_BEHAVIOURAL.ok,
          strength: "A clear situation, set in a sentence.",
          followup: "measurable outcome",
        };
        turns.push({
          question: story.question,
          answerFor: (tier) =>
            tier === "weak"
              ? `${story.situation} ${story.taskWe} ${story.actionVague} ${story.resultVague}`
              : tier === "ok"
                ? `${story.situation} ${story.taskI} ${story.actionSpecific} ${story.resultVague}`
                : `${story.situation} ${story.taskI} ${story.actionSpecific} ${story.resultQuantified} ${story.reflection}`,
          gap: { ...gap, gap: GAPS_BEHAVIOURAL.ok },
        });
        if (turns.length < plan.answers) {
          turns.push({
            question: story.followUp,
            answerFor: (tier) =>
              tier === "weak" ? story.followUpWeak : story.followUpStrong,
            gap: {
              gap: GAPS_BEHAVIOURAL.weak,
              strength: "Owned the decision in the first person.",
              followup: "personal ownership",
            },
          });
        }
      }
    } else if (plan.type === "technical_swe") {
      covered.scale_tradeoffs = 0.62;
      covered.communication = 0.5;
      while (turns.length < plan.answers) {
        const problem = TECHNICAL[technicalCursor % TECHNICAL.length];
        technicalCursor += 1;
        turns.push({
          question: problem.question,
          answerFor: (tier) => problem[tier],
          gap: {
            gap: GAPS_TECHNICAL.ok,
            strength: "Compared two approaches before choosing.",
            followup: "edge cases",
          },
        });
        if (turns.length < plan.answers) {
          turns.push({
            question: problem.followUp,
            answerFor: (tier) =>
              tier === "weak" ? problem.followUpWeak : problem.followUpStrong,
            gap: {
              gap: GAPS_TECHNICAL.weak,
              strength: "Explained why, not only what.",
              followup: "complexity",
            },
          });
        }
      }
    } else {
      covered.communication = 0.55;
      while (turns.length < plan.answers) {
        const item =
          SCREENING_QUESTIONS[screeningCursor % SCREENING_QUESTIONS.length];
        screeningCursor += 1;
        turns.push({
          question: item.question,
          answerFor: (tier) => (tier === "weak" ? item.weak : item.strong),
          gap: {
            gap: "Motivation stays general rather than tied to this role.",
            strength: "Background summarised concisely.",
            followup: "motivation",
          },
        });
      }
    }

    // Opening, as `append_interview_turn` writes it: the interviewer first.
    messages.push({
      role: "assistant",
      content: `Hi Alex, I'm ${persona.name}. Thanks for making the time. ${turns[0].question}`,
      turn_index: turn,
      created_at: clock,
    });

    let state = createInterviewSessionState(id, persona.name);
    const analysisHistory: AnalysisResult[] = [];
    const answerTimes: string[] = [];

    turns.forEach((item, index) => {
      // Scores wander around the session's level rather than sitting on it.
      const answerScore = Math.round(
        clamp(plan.score + (random() - 0.5) * 12, 30, 95),
      );
      const tier = tierFor(answerScore);
      let answer = item.answerFor(tier);

      if (plan.voice) {
        const fillerCount = Math.round(
          (1 - voiceProgress) * 5 + random() * 1.5,
        );
        answer = withFillers(
          answer.replace(/```[\s\S]*?```/g, "").trim(),
          fillerCount,
          random,
        );
        const longPauses = Math.round((1 - voiceProgress) * 2 + random() * 0.8);
        const wpm = Math.round(sessionWpm + (random() - 0.5) * 14);
        const delivery = analyzeDelivery(
          answer,
          phraseTimings(answer, wpm, longPauses),
        );
        deliverySnapshots.push({
          ...deliverySnapshotFromMetrics(delivery),
          recordedAt: addSeconds(clock, 60),
        });
      }

      const analysis = authoredAnalysis({
        type: plan.type,
        score: answerScore,
        answer,
        random,
        storyGap: item.gap,
      });
      clock = addSeconds(clock, 75 + Math.floor(random() * 90));
      turn += 1;
      messages.push({
        role: "user",
        content: answer,
        turn_index: turn,
        created_at: clock,
      });
      const strategy = strategyFor(plan.type, tier);
      analyses.push({
        turn_index: turn,
        round_type: plan.type,
        overall_score: answerScore,
        strategy,
        confidence: Math.round(60 + random() * 25),
        analysis,
      });
      analysisHistory.push(analysis);
      answerTimes.push(clock);

      const next = turns[index + 1];
      const reply = next
        ? `${tier === "strong" ? "That's a clear example." : "Thanks."} ${next.question}`
        : "That's all my questions. Thanks, Alex, this was useful.";
      state = recordInterviewTurn(state, {
        question: reply,
        analysis,
        decision: {
          strategy,
          reason: "",
          confidence: 70,
          shouldEscalate: tier === "strong",
          shouldSlowDown: tier === "weak",
          nextFocus: analysis.followupTopics[0] ?? "specific examples",
        },
      });
      clock = addSeconds(clock, 20 + Math.floor(random() * 25));
      turn += 1;
      messages.push({
        role: "assistant",
        content: reply,
        turn_index: turn,
        created_at: clock,
      });
    });

    const averageScore = Math.round(
      analyses.reduce((sum, row) => sum + row.overall_score, 0) /
        analyses.length,
    );
    const metrics = {
      ...buildInterviewMetrics({
        analyses: analysisHistory,
        state,
        restoredTurns: 0,
      }),
      sessionId: id,
      // The shared helpers stamp the wall clock; a seeded answer's time is
      // when it was given, which also keeps a re-seed identical.
      lastUpdated: clock,
      dimensionSnapshots: analysisHistory.map((analysis, index) => ({
        ...dimensionSnapshotFromAnalysis(analysis),
        recordedAt: answerTimes[index],
      })),
      ...(deliverySnapshots.length ? { deliverySnapshots } : {}),
    };

    const status = plan.status ?? "completed";
    const endedAt = clock;
    const activeSeconds = Math.round(
      (Date.parse(endedAt) - Date.parse(startedAt)) / 1000,
    );
    const scenarioTitle = plan.loop
      ? buildRoundScenarioTitle(brief, loop)
      : briefTitle(brief);

    const row: Record<string, unknown> = {
      id,
      practice_mode: plan.voice ? "voice" : "text",
      scenario_value: "custom",
      scenario_title: scenarioTitle,
      scenario_description: buildRoundScenarioDescription(brief, loop),
      persona_id: null,
      persona_name: persona.name,
      persona_config: persona,
      job_description_id: null,
      status,
      summary:
        status === "abandoned"
          ? null
          : tierFor(averageScore) === "strong"
            ? "Clear, specific answers with measured outcomes. Keep naming edge cases and tradeoffs before you are asked."
            : tierFor(averageScore) === "ok"
              ? "Solid structure and personal ownership. Results are often described without a measure; end on what changed, with a number."
              : "Answers describe what the team did more than what you did, and rarely say what changed. Lead with your own actions and finish on a result.",
      turn_count: turn,
      metrics,
      launch_meta: launchMeta,
      loop_id: null,
      loop_progress: null,
      competency_coverage: { covered },
      average_score: averageScore,
      duration_minutes:
        status === "abandoned"
          ? Math.max(1, Math.round(activeSeconds / 60))
          : Math.round(activeSeconds / 60),
      active_seconds: activeSeconds,
      title: plan.title ?? null,
      tags: plan.tags ?? [],
      pinned: plan.pinned ?? false,
      notes: null,
      archived_at: plan.archived ? isoAt(now, plan.daysAgo - 2, 9) : null,
      started_at: startedAt,
      ended_at: status === "completed" ? endedAt : null,
      created_at: startedAt,
      updated_at: endedAt,
    };

    return {
      id,
      withResume: Boolean(plan.withResume),
      loop: plan.loop ?? null,
      row,
      messages,
      analyses,
    };
  });

  return { resume, sessions };
}

/**
 * Loop columns, which need every round's id: `loop_id` shared by the rounds,
 * and `loop_progress.completedSessionIds` naming the rounds before each one,
 * exactly as `next-round` writes them.
 */
export function applyLoops(dataset: DemoDataset, newId: () => string): void {
  const groups = new Map<string, DemoSession[]>();
  for (const session of dataset.sessions) {
    if (!session.loop) continue;
    const group = groups.get(session.loop.group) ?? [];
    group[session.loop.index] = session;
    groups.set(session.loop.group, group);
  }
  for (const group of groups.values()) {
    const loopId = newId();
    group.forEach((session, index) => {
      const launch = session.row.launch_meta as {
        interviewLoop: LoopProgress["loop"];
      };
      session.row.loop_id = loopId;
      session.row.loop_progress = {
        loopId,
        loop: launch.interviewLoop,
        completedSessionIds: group.slice(0, index).map((earlier) => earlier.id),
      } satisfies LoopProgress;
    });
  }
}
