import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Command,
  Lightbulb,
  Mic,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = {
  title: "Tips & guides · ConvoTrainer",
};

interface Guide {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  title: string;
  description: string;
  points: { label: string; body: string }[];
}

const GUIDES: Guide[] = [
  {
    icon: Target,
    color: "bg-blue-100 text-blue-600",
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
    icon: BarChart3,
    color: "bg-purple-100 text-purple-600",
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
        label: "Confidence",
        body: "Clear, direct phrasing without hedging or filler reads as more credible.",
      },
      {
        label: "Adaptive follow-ups",
        body: "The interviewer drills into weak spots — vague answers get probed harder.",
      },
    ],
  },
  {
    icon: Lightbulb,
    color: "bg-amber-100 text-amber-600",
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
        label: "Iterate",
        body: "Start simple, get it working, then optimize. Mention what you'd improve with more time.",
      },
    ],
  },
  {
    icon: Mic,
    color: "bg-indigo-100 text-indigo-600",
    title: "Voice delivery",
    description: "Voice mode measures how you sound, not just what you say.",
    points: [
      {
        label: "Pace",
        body: "Aim for ~130–160 words per minute. Too fast reads as nervous; too slow loses the room.",
      },
      {
        label: "Filler words",
        body: "'Um', 'like', 'basically' — a short pause is always better than a filler.",
      },
      {
        label: "Pauses",
        body: "A deliberate pause before answering shows composure. Long mid-answer gaps don't.",
      },
      {
        label: "Barge-in",
        body: "You can start speaking to interrupt the interviewer — just like a real conversation.",
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-8 bg-linear-to-br from-gray-50 via-white to-gray-50/50 p-8">
      {/* Was a hand-rolled copy of PageHeader's exact eyebrow and h1 classes,
          minus `leading-relaxed` on the description and with the icon crammed
          into the eyebrow instead of its own tile. The only dashboard page not
          using the shared header. */}
      <PageHeader
        eyebrow="Tips & guides"
        title="Interview better, faster"
        description="The frameworks behind the feedback. Skim these before a session to get more out of every answer."
        icon={<BookOpen className="h-6 w-6" />}
        iconColor="teal"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {GUIDES.map((guide) => {
          const Icon = guide.icon;
          return (
            <Card key={guide.title} className="border-gray-200/80">
              <CardHeader>
                <div
                  className={`mb-3 flex h-11 w-11 items-center justify-center rounded-lg ${guide.color}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{guide.title}</CardTitle>
                <CardDescription>{guide.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3">
                  {guide.points.map((point) => (
                    <div key={point.label} className="flex gap-3">
                      <dt className="w-24 shrink-0 text-sm font-semibold text-gray-900">
                        {point.label}
                      </dt>
                      <dd className="flex-1 text-sm leading-relaxed text-gray-600">
                        {point.body}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="shadow-soft bg-linear-to-br from-blue-50 via-white to-indigo-50/40">
        <CardContent className="flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-gray-700 shadow-soft">
              <Command className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Pro tip: ⌘K</p>
              <p className="text-sm text-gray-600">
                Press{" "}
                <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs font-medium">
                  ⌘K
                </kbd>{" "}
                anywhere to jump to a page or start practicing instantly.
              </p>
            </div>
          </div>
          <Button asChild>
            <Link href="/simulate/setup">Start a session</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
