import Link from "next/link";
import { Compass, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageContainer, PageHeader } from "@/components/dashboard/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TOUR_HREF } from "@/lib/onboarding";

export const metadata = {
  title: "Tips & guides · ConvoTrainer",
};

/**
 * A guide is a title, a line and a list. Each one used to lead with an icon in
 * a tinted tile, six tiles saying nothing the title did not.
 */
interface Guide {
  title: string;
  description: string;
  points: { label: string; body: string }[];
}

/**
 * Every number and behaviour stated here is read from the code that produces
 * it, not from memory: the pace bands and filler rules from `speech-metrics.ts`,
 * the answer limits from the chat and voice pages, the technical axes from
 * `dimension-radar.tsx`. This page previously told people to aim for 130–160
 * words a minute (the app's bands are 110–185), that speaking interrupts the
 * interviewer (only tapping the mic does), and called a score card by a name
 * the report no longer uses. Change the source, then change this.
 */
const GUIDES: Guide[] = [
  {
    title: "Before you start",
    description: "A few setup choices change what the practice feels like.",
    points: [
      {
        label: "Text or voice",
        body: "Both are scored on the same rubric. Text is there for when speaking aloud isn't an option — a quiet train, a sore throat, or a voice you can't use.",
      },
      {
        label: "Accents",
        body: "In voice mode each interviewer speaks English with their nationality's accent, and neutral English when there's no matching voice. Switch off Interviewer accents in setup's last step to hear neutral English throughout.",
      },
      {
        label: "Difficulty",
        body: "Stricter, less warm interviewers ask harder questions. The report says how hard yours was, so compare scores from similar interviewers.",
      },
      {
        label: "Time",
        body: "Each answer has a limit: five minutes in text, three in voice.",
      },
    ],
  },
  {
    title: "The STAR method",
    description:
      "The structure behavioral interviewers look for. Use it for any 'tell me about a time…' question.",
    points: [
      {
        label: "Situation",
        body: "Set the scene in one or two sentences — the context and stakes.",
      },
      {
        label: "Task",
        body: "What was your specific responsibility or goal?",
      },
      {
        label: "Action",
        body: "What did YOU do? Use 'I', not 'we'. This is the bulk of a strong answer.",
      },
      {
        label: "Result",
        body: "Quantify the outcome — a %, a number, a timeframe. End on impact.",
      },
    ],
  },
  {
    title: "How scoring works",
    description:
      "Every answer is scored on the dimensions a real interviewer weighs.",
    points: [
      {
        label: "Structure",
        body: "Behavioral rounds score STAR coverage; technical rounds score approach and correctness.",
      },
      {
        label: "Specificity",
        body: "Concrete details, numbers, and named outcomes score higher than vague claims.",
      },
      {
        label: "Communication",
        body: "Clear, direct phrasing without hedging reads as more credible. It's the Communication card on your report.",
      },
      {
        label: "Follow-ups",
        body: "The interviewer probes weak spots — an unclear role, an unquantified result. How hard depends on the interviewer.",
      },
      {
        label: "Predict first",
        body: "The first time you open a report, guess your overall score before it's shown. The gap between how it felt and how it went is worth knowing.",
      },
    ],
  },
  {
    title: "Technical & system design",
    description:
      "Technical rounds aren't scored on STAR — they're scored on how you think.",
    points: [
      {
        label: "Clarify first",
        body: "Restate the problem and ask about constraints before diving in.",
      },
      {
        label: "Think out loud",
        body: "Narrate your approach and tradeoffs — interviewers score reasoning, not just the answer.",
      },
      {
        label: "Complexity",
        body: "State time/space complexity and where the bottlenecks are.",
      },
      {
        label: "Edge cases",
        body: "Say what happens with empty, huge or malformed input. Edge cases and code quality are scored separately from correctness.",
      },
      {
        label: "Iterate",
        body: "Start simple, get it working, then optimize. Mention what you'd improve with more time.",
      },
    ],
  },
  {
    title: "Voice delivery",
    description:
      "Voice mode also tells you how you sounded. Delivery is feedback — your score comes from what you said.",
    points: [
      {
        label: "Pace",
        body: "Roughly 110–185 words a minute reads as measured or conversational. Slower or faster gets flagged.",
      },
      {
        label: "Filler words",
        body: "'Um', 'uh', 'you know', 'I mean' and 'sort of' are counted; 'like' and 'basically' only next to a hesitation. A short pause beats a filler.",
      },
      {
        label: "Pauses",
        body: "Gaps of more than about a second and a half mid-answer are counted. Taking a moment before you start is fine.",
      },
      {
        label: "Interrupting",
        body: "Tap the mic while the interviewer is talking to cut in. Otherwise it opens by itself when they finish.",
      },
    ],
  },
  {
    title: "After the interview",
    description: "The report is where the practice turns into progress.",
    points: [
      {
        label: "Each answer",
        body: "Every scored answer shows its score. Open 'See a stronger answer' for your answer rewritten, a suggested answer and tips.",
      },
      {
        label: "Takeaways",
        body: "The report ends with a private box for what you'll do differently. Write it while it's fresh.",
      },
      {
        label: "Practise again",
        body: "Reruns the same setup. Change one thing — a harder interviewer, a longer round — before you start.",
      },
      {
        label: "Compare",
        body: "On the Sessions page, tick two attempts and choose Compare to see what changed.",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Tips & guides"
        description="The frameworks behind the feedback. Skim these before an interview to get more out of every answer."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {GUIDES.map((guide) => (
          <Card key={guide.title}>
            <CardHeader>
              <CardTitle className="text-lg">{guide.title}</CardTitle>
              <CardDescription>{guide.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                {guide.points.map((point) => (
                  <div key={point.label} className="flex gap-3">
                    <dt className="w-28 shrink-0 text-sm font-semibold text-slate-900">
                      {point.label}
                    </dt>
                    <dd className="flex-1 text-sm leading-relaxed text-slate-600">
                      {point.body}
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle as="h2" className="text-lg">
              Take the tour
            </CardTitle>
            <p className="mt-1.5 text-sm text-slate-600">
              A short walk around the dashboard: where to start, how to track
              your progress and where your documents live.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={TOUR_HREF}>
              <Compass />
              Take the tour
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* A plain card: the gradient ground and the icon tile it had were the
          last two decorations on this page. */}
      <Card>
        <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle as="h2" className="text-lg">
              Keyboard shortcut
            </CardTitle>
            <p className="mt-1.5 text-sm text-slate-600">
              Press{" "}
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium">
                ⌘K
              </kbd>{" "}
              (
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-xs font-medium">
                Ctrl K
              </kbd>{" "}
              on Windows) anywhere to jump to a page or start an interview.
            </p>
          </div>
          <Button asChild>
            <Link href="/simulate/setup">
              <Plus />
              New interview
            </Link>
          </Button>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
