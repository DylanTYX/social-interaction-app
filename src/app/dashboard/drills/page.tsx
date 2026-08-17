"use client";

import { readJson } from "@/lib/api/fetch-json";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dumbbell,
  PenLine,
  RefreshCw,
  Send,
  Shuffle,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CONTENT_ENTER } from "@/lib/motion";
import { ChoiceChip } from "@/components/ui/choice-chip";
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
import type { SuggestedAnswerResult } from "@/lib/coach-contract";

function pickRandom(
  questions: DrillQuestion[],
  excludeId?: string,
): DrillQuestion {
  if (questions.length === 0) {
    return { id: "empty", category: "behavioral", prompt: "" };
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
  const [pendingSwitch, setPendingSwitch] = useState<{
    category?: DrillCategory | "all";
  } | null>(null);

  const answerRef = useRef<HTMLTextAreaElement>(null);
  const coachingRef = useRef<HTMLDivElement>(null);

  const nextQuestion = (nextCategory?: DrillCategory | "all") => {
    const targetPool =
      nextCategory !== undefined ? getQuestionsForCategory(nextCategory) : pool;
    setQuestion(pickRandom(targetPool, question.id));
    setAnswer("");
    setSubmittedAnswer("");
    setResult(null);
    setError(null);
  };

  /**
   * Both paths to a new question throw away whatever is in the textarea, which
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

  const handleSubmit = async () => {
    const trimmed = answer.trim();
    if (trimmed.length < 10 || loading) return;

    setLoading(true);
    setSubmittedAnswer(trimmed);
    setError(null);
    setResult(null);
    try {
      const roundType =
        question.category === "leadership" ? "behavioral" : question.category;
      const response = await fetch("/api/coach/suggested-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.prompt,
          answer: trimmed,
          roundType,
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
    answerRef.current?.focus({ preventScroll: true });
    answerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
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

  const meta = getCategoryMeta(
    question.category === "leadership" ? "leadership" : question.category,
  );

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
        eyebrow="Quick drills"
        title="One question. Instant feedback."
        description="No setup, no full session - answer a single question and get it rewritten in your own words, with targeted tips and a full example answer, in seconds."
        icon={<Dumbbell className="h-6 w-6" />}
        iconColor="pink"
      />

      {/* `ChoiceChip` rather than hand-rolled buttons. These were ~34px with no
          `aria-pressed` and no focus-visible ring, so selection was conveyed by
          colour alone and a keyboard user got nothing. The shared component has
          existed for exactly this and was only used in the setup wizard. */}
      <div className="flex flex-wrap gap-2">
        <ChoiceChip
          selected={category === "all"}
          onClick={() => handleCategory("all")}
        >
          All
        </ChoiceChip>
        {DRILL_CATEGORIES.map((cat) => (
          <ChoiceChip
            key={cat.id}
            selected={category === cat.id}
            onClick={() => handleCategory(cat.id)}
          >
            {cat.label}
          </ChoiceChip>
        ))}
      </div>

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
          <div className="flex items-center justify-between gap-2">
            <Badge variant="outline" className="capitalize">
              {meta.label}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => requestNewQuestion()}
              className="gap-1.5 text-slate-500"
            >
              <Shuffle className="h-3.5 w-3.5" />
              New question
            </Button>
          </div>
          <CardTitle className="pt-2 text-xl leading-snug">
            {question.prompt}
          </CardTitle>
          <CardDescription>{meta.blurb}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Six rows rather than eight: the textarea spans the whole card
              now, and `field-sizing-content` grows it from there as you type. */}
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
                  Get feedback
                </>
              )}
            </Button>
          </div>
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
                    Revise this answer
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => nextQuestion()}
                    className="gap-2"
                  >
                    <Shuffle className="h-4 w-4" />
                    Next question
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
        title="Discard your answer?"
        description="Moving to a new question clears what you have written. Get feedback first if you want to keep it."
        confirmLabel="Discard and continue"
        onConfirm={() => {
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
