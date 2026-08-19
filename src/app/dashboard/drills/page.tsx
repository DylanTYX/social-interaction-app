"use client";

import { readJson } from "@/lib/api/fetch-json";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dumbbell,
  Gauge,
  Mic,
  PenLine,
  RefreshCw,
  Send,
  Shuffle,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CONTENT_ENTER } from "@/lib/motion";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  DRILL_CATEGORIES,
  DRILL_GROUPS,
  getCategoryMeta,
  getQuestionsForCategory,
  type DrillCategory,
  type DrillQuestion,
} from "@/lib/question-bank";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  CoachingResult,
  CoachingResultSkeleton,
} from "@/components/coach/coaching-result";
import type { SpeechAnswerCompletion } from "@/hooks/use-speech-answer";
import type { AnswerMode, SuggestedAnswerResult } from "@/lib/coach-contract";

/**
 * `ssr: false` is not a preference.
 *
 * `DrillSpeakInput` reaches `speech-service.ts`, which imports the Azure Speech
 * SDK at module scope, and the SDK resolves a Node-only certificate path when
 * it is evaluated on the server. `simulate/voice/page.tsx` loads its screen the
 * same way for the same reason. Everything else on this page renders normally;
 * only the microphone waits for the browser.
 */
const DrillSpeakInput = dynamic(
  () =>
    import("@/components/coach/drill-speak-input").then(
      (module) => module.DrillSpeakInput,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-36 items-center justify-center text-sm text-muted-foreground">
        Getting the microphone ready…
      </div>
    ),
  },
);

/** How long a spoken drill answer may run. Shorter than an interview turn's
 *  three minutes: a drill is one question, not a conversation. */
const SPOKEN_ANSWER_SECONDS = 120;

/**
 * The two ways to answer a drill.
 *
 * There is deliberately no code editor here, though `AnswerMode` on the wire
 * still has a `code` member — the report sends it for fenced answers written
 * during a session. A drill is defined by being quick: no setup, one question,
 * seconds to feedback. Writing and debugging a function is none of those, and
 * it is the one kind of answer that most needs the follow-up ("what is the
 * complexity?", "what about empty input?") that only a real round can give.
 *
 * The technical questions stay, because they were never coding questions. Every
 * one in the bank asks you to *talk*: "walk me through it", "talk through your
 * approach and complexity". `COACH_RUBRICS.technical_swe` even lists "code
 * delivered with no narration" as a failure mode — so an editor here would
 * invite the exact answer the rubric marks down.
 *
 * Distinct from `AnswerMode` for one more reason: "type" and "speak" both
 * produce prose, and the coach is told which so it does not bill a transcript
 * for punctuation nobody spoke.
 */
type DrillInputMode = "type" | "speak";

const WIRE_MODE: Record<DrillInputMode, AnswerMode> = {
  type: "text",
  speak: "speech",
};

function pickRandom(
  questions: DrillQuestion[],
  excludeId?: string,
): DrillQuestion {
  if (questions.length === 0) {
    return { id: "empty", category: "behavioural", prompt: "" };
  }
  if (questions.length === 1) return questions[0];
  let next = questions[Math.floor(Math.random() * questions.length)];
  // Avoid repeating the same question twice in a row.
  let guard = 0;
  while (next.id === excludeId && guard < 10) {
    next = questions[Math.floor(Math.random() * questions.length)];
    guard += 1;
  }
  return next;
}

export default function DrillsPage() {
  const [category, setCategory] = useState<DrillCategory | "all">("all");
  const pool = useMemo(() => getQuestionsForCategory(category), [category]);
  const [question, setQuestion] = useState<DrillQuestion>(() =>
    pickRandom(getQuestionsForCategory("all")),
  );
  const [answer, setAnswer] = useState("");
  /**
   * The answer as it was when the request went out.
   *
   * A correctness requirement, not a nicety. `handleSubmit` is not one-shot —
   * you can edit and ask again — and the coaching now renders your answer
   * *beside* its rewrite. Rendering the live `answer` there would let a
   * post-feedback edit silently mutate the "Your answer" half while the rewrite
   * next to it still described the old text, which is a comparison that lies.
   */
  const [submittedAnswer, setSubmittedAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SuggestedAnswerResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Speaking is the default because an interview is spoken.
   *
   * A drill that only ever takes typing is the fastest loop in the product
   * aimed at the half of the skill nobody is assessed on. The cost of the
   * default is one speech-token request on mount; the microphone itself is not
   * touched until the candidate presses record, so no permission prompt fires
   * for someone who came here to type.
   */
  const [mode, setMode] = useState<DrillInputMode>("speak");
  /**
   * Pace, fillers and long pauses for the answer that produced `result`.
   *
   * Held beside the coaching rather than inside it because it is measured here
   * — `analyzeDelivery` runs in the browser off the recognizer's own phrase
   * timings — and costs no tokens. It is also the only feedback on this page
   * that a typed answer genuinely cannot have.
   */
  const [deliveryNote, setDeliveryNote] = useState<string | null>(null);

  const [pendingSwitch, setPendingSwitch] = useState<{
    category?: DrillCategory | "all";
    mode?: DrillInputMode;
  } | null>(null);

  const answerRef = useRef<HTMLTextAreaElement>(null);
  const coachingRef = useRef<HTMLDivElement>(null);

  const meta = getCategoryMeta(question.category);
  const clearAnswer = () => {
    setAnswer("");
    setSubmittedAnswer("");
    setResult(null);
    setError(null);
    setDeliveryNote(null);
  };

  const nextQuestion = (nextCategory?: DrillCategory | "all") => {
    const targetPool =
      nextCategory !== undefined ? getQuestionsForCategory(nextCategory) : pool;
    setQuestion(pickRandom(targetPool, question.id));
    clearAnswer();
  };

  /**
   * Every path to a new question throws away whatever is in the textarea, which
   * is correct — an answer to a question you can no longer see is noise — but
   * it used to happen silently, and the category chips *look* like a filter.
   * Typing three paragraphs and then narrowing to "System design" destroyed
   * them with no warning and no undo.
   *
   * Only confirms once there is something worth losing. Below the 10-character
   * submit threshold there is nothing to protect and a dialog would just be in
   * the way.
   */
  const requestNewQuestion = (nextCategory?: DrillCategory | "all") => {
    if (answer.trim().length >= 10) {
      setPendingSwitch({ category: nextCategory });
      return;
    }
    if (nextCategory !== undefined) setCategory(nextCategory);
    nextQuestion(nextCategory);
  };

  const handleCategory = (next: DrillCategory | "all") => {
    requestNewQuestion(next);
  };

  /**
   * Changing how you answer clears what you have written, for the same reason
   * changing the question does: a typed draft is not a spoken answer, and
   * carrying it across would put text in the box that the microphone is about
   * to overwrite. Guarded by the same threshold and the same dialog.
   */
  const requestMode = (next: DrillInputMode) => {
    if (next === mode) return;
    if (answer.trim().length >= 10) {
      setPendingSwitch({ mode: next });
      return;
    }
    setMode(next);
    clearAnswer();
  };

  const handleSubmit = async (override?: string, forMode?: DrillInputMode) => {
    // Speaking hands its answer straight in: the transcript reaches
    // `setAnswer` in the same tick as this call, and state is not readable
    // until the next render.
    const trimmed = (override ?? answer).trim();
    const submitMode = forMode ?? mode;
    if (trimmed.length < 10 || loading) return;

    setLoading(true);
    setSubmittedAnswer(trimmed);
    setError(null);
    setResult(null);
    /**
     * Dropped for anything that was not spoken.
     *
     * "Revise this answer" hands a transcript to the textarea, so the very next
     * submission is typed — and without this the pace and filler counts from
     * the spoken attempt stayed on screen beside coaching for the edited one,
     * claiming three fillers about text that contains none. The same class of
     * lie `submittedAnswer` exists to prevent.
     */
    if (submitMode !== "speak") setDeliveryNote(null);
    try {
      /**
       * The topic's rubric, read from the topic itself.
       *
       * This used to be `question.category` with one hardcoded exception for
       * `leadership`, which worked only because six of the seven category ids
       * happened to be spelled the same as round type ids. They are not the
       * same thing and were never guaranteed to agree: `isRoundType` rejects
       * anything it does not recognise, `roundType` then arrives undefined, and
       * the route falls back to the behavioural STAR rubric — so an operating
       * systems answer would have been marked for storytelling, with nothing on
       * screen to show it had happened. `DrillCategoryMeta.roundType` is the
       * mapping, and eight topics now share one round type through it.
       */
      const response = await fetch("/api/coach/suggested-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.prompt,
          answer: trimmed,
          roundType: meta.roundType,
          answerMode: WIRE_MODE[submitMode],
        }),
      });
      // `readJson` surfaces the server's own message and, unlike parsing
      // directly, survives a non-JSON error body — a proxy 502 or an auth
      // redirect returns HTML, which used to throw a parse error and mask the
      // real status.
      setResult(await readJson<SuggestedAnswerResult>(response));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not generate feedback.",
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * The way back up.
   *
   * Stacked, the textarea is offscreen from the bottom of the coaching card, so
   * revising an answer after reading the feedback would mean hunting for it.
   * `preventScroll` first, because focus otherwise fires an instant jump that
   * the smooth scroll then has to fight.
   */
  const handleRevise = () => {
    // Revising means editing words, which only the textarea can do — so this
    // also drops out of speak mode, carrying the transcript into the box
    // rather than discarding it the way an ordinary mode switch does.
    setMode("type");
    answerRef.current?.focus({ preventScroll: true });
    answerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  /**
   * A spoken answer, finished.
   *
   * Submitted straight away rather than dropped into the textarea for review:
   * the whole loop is tap, talk, pause, read — and `useSpeechAnswer` ends the
   * answer on a long pause, so there is no button between speaking and getting
   * the coaching. The transcript still lands in `answer`, which is what makes
   * "Revise this answer" able to hand it to the textarea.
   */
  const handleSpoken = ({
    transcript,
    deliveryNote,
  }: SpeechAnswerCompletion) => {
    setDeliveryNote(deliveryNote);
    setAnswer(transcript);

    if (transcript.trim().length < 10) {
      setError(
        transcript.trim()
          ? "That was too short to coach. Try answering in a few sentences."
          : "Nothing was picked up. Check your microphone and try again.",
      );
      setResult(null);
      return;
    }

    void handleSubmit(transcript, "speak");
  };

  /**
   * Bring the coaching into view as soon as it is requested.
   *
   * Stacked, the card mounts below the fold, so pressing "Get feedback" would
   * otherwise look like nothing happened. Keyed on `loading` rather than on
   * `result` deliberately: the skeleton is then what the user watches fill in,
   * and anchoring at the *start* of the card means a result taller than the
   * skeleton grows downwards instead of shifting what they are already reading.
   */
  useEffect(() => {
    if (loading) {
      coachingRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [loading]);

  // Nothing to show before the first submission — see the card below.
  const hasCoaching = loading || error !== null || result !== null;
  const answerEdited = result !== null && answer.trim() !== submittedAnswer;

  return (
    <div className="space-y-6 bg-linear-to-br from-slate-50 via-white to-slate-50/50 p-8">
      {/* Full width, like every other dashboard page.
          A `max-w-5xl` reading column was tried here and removed: the readability
          problem it solved is already solved one level down, where the prose
          blocks inside `CoachingResult` carry `max-w-prose`. Capping the page as
          well only made drills the one dashboard route with its own width rule. */}
      <PageHeader
        eyebrow="Quick Drills"
        title="One question. Instant feedback."
        description="No setup, no full session - answer a single question and get it rewritten in your own words, with targeted tips and a full example answer, in seconds."
        icon={<Dumbbell className="h-6 w-6" />}
        iconColor="pink"
      />

      {/* Answer above, coaching below, both full width.

          This was `lg:grid-cols-2`, and grid stretches: the coaching card runs
          300-400px taller than this one, so the answer card grew that much dead
          whitespace beneath an 8-row textarea. `Card` is `flex flex-col gap-6`
          with no `flex-1` anywhere, so the slack pooled at the bottom rather
          than being absorbed. Matched heights and that whitespace were the same
          fact, and only one of them could be kept.

          The split's one real benefit was the candidate's own answer sitting
          beside the tightened rewrite. That comparison moved *inside* the
          coaching block, where the two halves are the same text twice and so
          cannot reproduce the mismatch that made this layout wrong.

          `persona-step.tsx` made the same call for the same reason. */}
      <Card className="shadow-soft">
        <CardHeader>
          {/* The topic picker lives here, where the topic is displayed.
              It used to be sixteen chips in three labelled rows above the card
              — the first thing on the page, and a wall of chrome in front of
              the one thing you came to read. Choosing a topic is occasional:
              you pick once and then drill several questions against it. So it
              collapses into the control that was already showing which topic
              you were on, and the question becomes the first thing you see.

              A grouped `Select` rather than a flat one: the three groups are
              the CS Core / specialisation line, and a fifteen-item list with no
              structure is the same wall in a smaller box. */}
          <div className="flex items-center justify-between gap-2">
            <Select
              value={category}
              onValueChange={(next) =>
                handleCategory(next as DrillCategory | "all")
              }
            >
              <SelectTrigger
                size="sm"
                aria-label="Drill topic"
                className="w-auto min-w-56 gap-2 font-medium"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Topics</SelectItem>
                {DRILL_GROUPS.map((group) => (
                  <SelectGroup key={group.id}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {DRILL_CATEGORIES.filter(
                      (cat) => cat.group === group.id,
                    ).map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => requestNewQuestion()}
              className="gap-1.5 text-slate-500"
            >
              <Shuffle className="h-3.5 w-3.5" />
              New Question
            </Button>
          </div>
          <CardTitle className="pt-2 text-xl leading-snug">
            {question.prompt}
          </CardTitle>
          {/* Names the topic while browsing everything.
              The badge this replaced was the only thing saying which topic a
              question came from, and on "All Topics" that is exactly when you
              cannot infer it from the picker. Redundant once a single topic is
              selected, so it is only shown when it is not. */}
          <CardDescription>
            {category === "all" ? `${meta.label} — ${meta.blurb}` : meta.blurb}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Speaking first, and the default, because that is what the product
              is for — an interview is spoken, and a drill that only ever takes
              typing trains the half of the skill nobody is assessed on. Typing
              stays because a transcript is not always what you want to work on,
              because the microphone can fail, and because "Revise this answer"
              lands here with the transcript already in the box. */}
          <div
            role="group"
            aria-label="How to answer"
            className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
          >
            {(
              [
                { id: "speak", label: "Speak", icon: Mic },
                { id: "type", label: "Type", icon: PenLine },
              ] as { id: DrillInputMode; label: string; icon: typeof Mic }[]
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                aria-pressed={mode === id}
                onClick={() => requestMode(id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  mode === id
                    ? "bg-white text-slate-900 shadow-soft"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {mode === "speak" ? (
            <DrillSpeakInput
              timeLimitSeconds={SPOKEN_ANSWER_SECONDS}
              // The question itself, so the recognizer is biased toward the
              // nouns it is about to hear.
              phraseList={[question.prompt]}
              disabled={loading}
              onComplete={handleSpoken}
            />
          ) : (
            <>
              {/* Six rows rather than eight: the textarea spans the whole card
                  now, and `field-sizing-content` grows it from there as you
                  type. */}
              <Textarea
                ref={answerRef}
                aria-label="Your answer"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Type your answer out loud, as if you were in the room…"
                rows={6}
                className="resize-none"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {answer.trim().length < 10
                    ? "Write a bit more to get feedback"
                    : `${answer.trim().split(/\s+/).length} words`}
                </span>
                <Button
                  onClick={() => void handleSubmit()}
                  disabled={answer.trim().length < 10 || loading}
                  className="gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Reviewing…
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Get Feedback
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Absent entirely until there is something in it.

          Side by side, an empty state filled a column that existed anyway. Full
          width and below the fold, a dashed placeholder would be a large box
          promising something the user has not asked for yet — and its copy was
          already carried by the page description above and by a button that
          says "Get feedback". */}
      {hasCoaching && (
        <Card
          ref={coachingRef}
          className={cn("scroll-mt-8 shadow-soft", CONTENT_ENTER)}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-warning" />
              Coaching
            </CardTitle>
            <CardDescription>
              {answerEdited
                ? "You have edited your answer since this feedback — get feedback again to refresh it."
                : "Your answer tightened, what to fix, and a full example answer if you want the ceiling."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Above the coaching, not inside it: this is measured in the
                browser from the recognizer's own phrase timings, costs no
                tokens, and is the one thing on this page a typed answer cannot
                have. `CoachingResult` is shared with the report, which shows
                delivery on the message bubble instead. */}
            {deliveryNote && (
              <p className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <Gauge className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-semibold uppercase tracking-wide text-slate-400">
                  Delivery
                </span>
                {deliveryNote}
              </p>
            )}
            {loading && <CoachingResultSkeleton />}
            {error && <p className="text-sm text-destructive">{error}</p>}
            {result && (
              <>
                <CoachingResult
                  result={result}
                  originalAnswer={submittedAnswer}
                />
                <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    onClick={handleRevise}
                    className="gap-2 text-slate-500"
                  >
                    <PenLine className="h-4 w-4" />
                    Revise This Answer
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => nextQuestion()}
                    className="gap-2"
                  >
                    <Shuffle className="h-4 w-4" />
                    Next Question
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <ConfirmDeleteDialog
        open={pendingSwitch !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSwitch(null);
        }}
        title="Discard Your Answer?"
        description={
          pendingSwitch?.mode
            ? "Changing how you answer clears what you have written. Get feedback first if you want to keep it."
            : "Moving to a new question clears what you have written. Get feedback first if you want to keep it."
        }
        confirmLabel="Discard and Continue"
        onConfirm={() => {
          // A mode switch keeps the question — you are answering the same thing
          // a different way — so it clears the answer without drawing a new one.
          if (pendingSwitch?.mode) {
            setMode(pendingSwitch.mode);
            clearAnswer();
            setPendingSwitch(null);
            return;
          }
          if (pendingSwitch?.category !== undefined) {
            setCategory(pendingSwitch.category);
          }
          nextQuestion(pendingSwitch?.category);
          setPendingSwitch(null);
        }}
      />
    </div>
  );
}
