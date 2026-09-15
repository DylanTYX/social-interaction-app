"use client";

import { readJson } from "@/lib/api/fetch-json";
import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { ArrowRight, Loader2, Mic, PenLine, Shuffle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CONTENT_ENTER } from "@/lib/motion";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  DRILL_CATEGORIES,
  DRILL_GROUPS,
  getCategoryMeta,
  getQuestionsForCategory,
  type DrillCategory,
  type DrillQuestion,
} from "@/lib/question-bank";
import {
  PageContainer,
  PageHeader,
  PANEL_LABEL,
} from "@/components/dashboard/page-header";
import {
  CoachingResult,
  CoachingResultSkeleton,
} from "@/components/coach/coaching-result";
import { DeliveryReadout } from "@/components/coach/delivery-readout";
import type { SpeechAnswerCompletion } from "@/hooks/use-speech-answer";
import type { DeliveryMetrics } from "@/lib/speech-metrics";
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
    // The recorder's own frame at its own height, so nothing moves when the
    // real one arrives.
    loading: () => (
      <div
        aria-busy="true"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      >
        <div className="flex items-center gap-4 px-4 py-4 sm:px-5">
          <Skeleton className="size-14 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900">
              Getting the microphone ready…
            </p>
            <Skeleton className="mt-1.5 h-3.5 w-64 max-w-full" />
          </div>
        </div>
        <div className="h-35 border-t border-slate-100 bg-slate-50/60" />
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

const subscribeToNothing = () => () => {};

/**
 * False while the server render is being hydrated, true from then on.
 *
 * The first question is a random draw, so the server and the browser each drew
 * a different one and React threw a hydration mismatch on every page load. The
 * question is now drawn in both places but only shown once this is true. On a
 * client-side navigation there is no hydration, so it is true immediately.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

export default function DrillsPage() {
  const hydrated = useHydrated();
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
   * that a typed answer genuinely cannot have. The full measurements rather
   * than the one-line summary, so the readout can show each one.
   */
  const [delivery, setDelivery] = useState<DeliveryMetrics | null>(null);

  const [pendingSwitch, setPendingSwitch] = useState<{
    category?: DrillCategory | "all";
    mode?: DrillInputMode;
  } | null>(null);

  const answerRef = useRef<HTMLTextAreaElement>(null);
  const coachingRef = useRef<HTMLDivElement>(null);
  /** Set by "Revise this answer" so the textarea is focused once it exists. */
  const focusAnswerOnMount = useRef(false);

  const meta = getCategoryMeta(question.category);
  const clearAnswer = () => {
    setAnswer("");
    setSubmittedAnswer("");
    setResult(null);
    setError(null);
    setDelivery(null);
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
    if (submitMode !== "speak") setDelivery(null);
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
    if (mode === "type") {
      focusAnswer();
      return;
    }
    // From speak mode the textarea does not exist until the next render, so
    // focusing it here found nothing and the page never scrolled back up.
    focusAnswerOnMount.current = true;
    setMode("type");
  };

  function focusAnswer() {
    answerRef.current?.focus({ preventScroll: true });
    answerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  useEffect(() => {
    if (mode === "type" && focusAnswerOnMount.current) {
      focusAnswerOnMount.current = false;
      focusAnswer();
    }
  }, [mode]);

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
    delivery: measured,
  }: SpeechAnswerCompletion) => {
    setDelivery(measured);
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

  const typedWords = answer.trim() ? answer.trim().split(/\s+/).length : 0;
  const SWITCH_LINK =
    "inline-flex items-center gap-1.5 rounded-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary-muted";

  return (
    <PageContainer>
      <PageHeader
        title="Quick drills"
        description="One question, answered out loud, coached in seconds."
      />

      {/* The question card is a stage: a thin toolbar for the occasional
          choices, the question set large, then the answer surface.

          Answer above, coaching below, both full width. This was
          `lg:grid-cols-2`, and grid stretches: the coaching card runs 300-400px
          taller than this one, so the answer card grew that much dead
          whitespace. The split's one real benefit, your answer beside the
          tightened rewrite, lives inside the coaching block instead. */}
      <Card className="gap-0 py-0">
        {/* The topic picker lives with the question it chooses. Choosing a
            topic is occasional: you pick once and drill several questions
            against it, so it is a menu, not a wall of chips. A grouped
            `Select`, because the three groups are the CS Core /
            specialisation line and a flat fifteen-item list hides that. */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-6">
          <Select
            value={category}
            onValueChange={(next) =>
              handleCategory(next as DrillCategory | "all")
            }
          >
            <SelectTrigger
              size="sm"
              aria-label="Drill topic"
              className="w-auto min-w-56 font-medium"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All topics</SelectItem>
              {/* A rule before each group, so the headings sit between blocks
                  rather than reading as list items. */}
              {DRILL_GROUPS.map((group) => (
                <SelectGroup key={group.id}>
                  <SelectSeparator />
                  <SelectLabel>{group.label}</SelectLabel>
                  {DRILL_CATEGORIES.filter((cat) => cat.group === group.id).map(
                    (cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.label}
                      </SelectItem>
                    ),
                  )}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => requestNewQuestion()}
            className="text-slate-600"
          >
            <Shuffle />
            New question
          </Button>
        </div>

        <div className="space-y-6 px-4 py-6 sm:px-6">
          {/* Full width, like the answer surface under it. Questions are
              short (72 characters at the median, 122 at most), so a
              reading-width cap only broke most of them into two short lines
              that left the right half of the card empty. `text-pretty`
              rather than `text-balance` for the same reason: balance evens
              the lines out and pulls them away from the edge; pretty fills
              the line and only stops a lone last word. */}
          {hydrated ? (
            <div className="space-y-2">
              {/* Names the topic while browsing everything, which is exactly
                  when the picker cannot. Redundant once one topic is chosen. */}
              {category === "all" && (
                <p className={PANEL_LABEL}>{meta.label}</p>
              )}
              <h2 className="font-display text-2xl leading-snug font-semibold tracking-tight text-pretty text-slate-900">
                {question.prompt}
              </h2>
              <p className="text-sm text-slate-500">{meta.blurb}</p>
            </div>
          ) : (
            <div className="space-y-2" aria-hidden>
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-full max-w-4xl" />
              <Skeleton className="h-4 w-64 max-w-full" />
            </div>
          )}

          <div className="space-y-3">
            {mode === "speak" ? (
              <DrillSpeakInput
                timeLimitSeconds={SPOKEN_ANSWER_SECONDS}
                // The question itself, so the recognizer is biased toward the
                // nouns it is about to hear.
                phraseList={[question.prompt]}
                disabled={loading}
                lastAnswer={answer}
                onComplete={handleSpoken}
              />
            ) : (
              // One box, like the job description and resume inputs: the text
              // area, and a footer with the count and the action. Its resting
              // height is the recorder's, so switching modes does not move
              // the page.
              <div className="rounded-xl border border-slate-200 bg-white transition-[border-color,box-shadow] duration-150 focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary-muted">
                <textarea
                  ref={answerRef}
                  aria-label="Your answer"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Write it the way you would say it in the room…"
                  rows={8}
                  className="block field-sizing-content min-h-45 w-full resize-none rounded-t-xl bg-transparent px-4 py-4 text-[15px] leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 sm:px-5"
                />
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-3 py-2">
                  <span className="pl-1 text-xs text-slate-500 tabular-nums sm:pl-2">
                    {answer.trim().length < 10
                      ? "Write a bit more to get feedback"
                      : `${typedWords} words`}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => void handleSubmit()}
                    disabled={answer.trim().length < 10 || loading}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="animate-spin" />
                        Reviewing…
                      </>
                    ) : (
                      <>
                        Get feedback
                        <ArrowRight />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Speaking first, and the default, because an interview is
                spoken. Typing stays, for when a transcript is not what you
                want to work on, when the microphone fails, and because
                "Revise this answer" lands here. It is offered as one line
                rather than a segmented toggle so the default reads as the
                default. */}
            {/* A flex row, not a button inside a sentence. Inline, the button's
                baseline came from its icon, which has none, so the icon's
                bottom edge sat on the text baseline and lifted the link above
                the words beside it. */}
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-slate-500">
              {mode === "speak" ? (
                <>
                  <span>Rather write it?</span>
                  <button
                    type="button"
                    onClick={() => requestMode("type")}
                    className={SWITCH_LINK}
                  >
                    <PenLine className="h-3.5 w-3.5" aria-hidden />
                    Type your answer
                  </button>
                </>
              ) : (
                <>
                  <span>Interviews are spoken.</span>
                  <button
                    type="button"
                    onClick={() => requestMode("speak")}
                    className={SWITCH_LINK}
                  >
                    <Mic className="h-3.5 w-3.5" aria-hidden />
                    Answer out loud instead
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      </Card>

      {/* Absent entirely until there is something in it. A dashed placeholder
          below the fold would promise something the user has not asked for. */}
      {hasCoaching && (
        <Card ref={coachingRef} className={cn("scroll-mt-8", CONTENT_ENTER)}>
          <CardHeader>
            <CardTitle className="text-lg">Coaching</CardTitle>
            <CardDescription>
              {answerEdited
                ? "You have edited your answer since this feedback. Get feedback again to refresh it."
                : delivery
                  ? "How it sounded, then your answer tightened, what to fix, and an example answer."
                  : "Your answer tightened, what to fix, and a full example answer if you want the ceiling."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* First, because it is ready first: measured in the browser the
                moment you stop, while the coach is still reading. */}
            {delivery && <DeliveryReadout metrics={delivery} />}
            {loading && <CoachingResultSkeleton />}
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive-border bg-destructive-subtle px-3 py-2 text-sm text-destructive-emphasis"
              >
                {error}
              </p>
            )}
            {result && (
              <CoachingResult
                result={result}
                originalAnswer={submittedAnswer}
              />
            )}
          </CardContent>
          {result && (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-6 pt-5">
              <Button
                variant="ghost"
                onClick={handleRevise}
                className="text-slate-600"
              >
                <PenLine />
                Revise this answer
              </Button>
              <Button onClick={() => nextQuestion()}>
                Next question
                <ArrowRight />
              </Button>
            </div>
          )}
        </Card>
      )}

      <ConfirmDeleteDialog
        open={pendingSwitch !== null}
        onOpenChange={(open) => {
          if (!open) setPendingSwitch(null);
        }}
        title="Discard your answer?"
        description={
          pendingSwitch?.mode
            ? "Changing how you answer clears what you have written. Get feedback first if you want to keep it."
            : "Moving to a new question clears what you have written. Get feedback first if you want to keep it."
        }
        confirmLabel="Discard and continue"
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
    </PageContainer>
  );
}
