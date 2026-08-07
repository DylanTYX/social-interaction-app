"use client";

import { useMemo, useState } from "react";
import {
  Dumbbell,
  Lightbulb,
  RefreshCw,
  Send,
  Shuffle,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

interface ModelAnswerResult {
  modelAnswer: string;
  rewrite: string;
  tips: string[];
}

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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ModelAnswerResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<{
    category?: DrillCategory | "all";
  } | null>(null);

  const nextQuestion = (nextCategory?: DrillCategory | "all") => {
    const targetPool =
      nextCategory !== undefined ? getQuestionsForCategory(nextCategory) : pool;
    setQuestion(pickRandom(targetPool, question.id));
    setAnswer("");
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
    setError(null);
    setResult(null);
    try {
      const roundType =
        question.category === "leadership" ? "behavioral" : question.category;
      const response = await fetch("/api/coach/model-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question.prompt,
          answer: trimmed,
          roundType,
        }),
      });
      const payload = (await response.json()) as ModelAnswerResult & {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not generate feedback.");
      }
      setResult(payload);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not generate feedback.",
      );
    } finally {
      setLoading(false);
    }
  };

  const meta = getCategoryMeta(
    question.category === "leadership" ? "leadership" : question.category,
  );

  return (
    <div className="space-y-6 bg-linear-to-br from-gray-50 via-white to-gray-50/50 p-8">
      <PageHeader
        eyebrow="Quick drills"
        title="One question. Instant feedback."
        description="No setup, no full session - answer a single question and get a model answer, a tightened rewrite, and targeted tips in seconds."
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Question + answer */}
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
                className="gap-1.5 text-gray-500"
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
            <Textarea
              aria-label="Your answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Type your answer out loud, as if you were in the room…"
              rows={8}
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

        {/* Feedback */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Coaching
            </CardTitle>
            <CardDescription>
              A model answer, your answer tightened, and what to fix.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!result && !loading && !error && (
              <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                  <Lightbulb className="h-6 w-6" />
                </div>
                <p className="mt-3 text-sm text-gray-500">
                  Answer the question and your feedback shows up here.
                </p>
              </div>
            )}
            {loading && (
              <div className="space-y-3">
                <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
                <div className="h-20 animate-pulse rounded bg-gray-100" />
                <div className="h-4 w-1/3 animate-pulse rounded bg-gray-200" />
                <div className="h-20 animate-pulse rounded bg-gray-100" />
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
            {result && (
              <>
                {result.tips.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      What to improve
                    </p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-gray-700">
                      {result.tips.map((tip, index) => (
                        <li key={index}>{tip}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {result.rewrite && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Your answer, tightened
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                      {result.rewrite}
                    </p>
                  </div>
                )}
                {result.modelAnswer && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                      Model answer
                    </p>
                    <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-gray-700">
                      {result.modelAnswer}
                    </p>
                  </div>
                )}
                <Button
                  variant="outline"
                  onClick={() => nextQuestion()}
                  className="w-full gap-2"
                >
                  <Shuffle className="h-4 w-4" />
                  Next question
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

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
