import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  MessageSquare,
  Mic,
  BarChart3,
  Sparkles,
  FileText,
  Target,
  Repeat,
  Lightbulb,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { AnimatedDemo } from "@/components/marketing/animated-demo";
import { Reveal } from "@/components/marketing/reveal";
import { StatCounter } from "@/components/marketing/stat-counter";
import { TryQuestion } from "@/components/marketing/try-question";
import { TILE_BORDERS, TILE_COLORS, type TileColor } from "@/lib/tile-colors";

const FEATURES: Array<{
  icon: LucideIcon;
  title: string;
  description: string;
  color: TileColor;
}> = [
  {
    icon: Target,
    color: "blue",
    title: "Adaptive questioning",
    description:
      "The interviewer scores every answer and uses it to choose the next question — drilling weak spots, easing off when you're strong.",
  },
  {
    icon: BarChart3,
    color: "purple",
    title: "Feedback that's specific",
    description:
      "Per-answer scoring on structure, specificity, and confidence — plus suggested answers and a tightened rewrite of your own response.",
  },
  {
    icon: Mic,
    color: "indigo",
    title: "Voice or text",
    description:
      "Practice out loud with a real-time voice interviewer, or type. Voice mode tracks your pace, filler words, and long pauses.",
  },
  {
    icon: FileText,
    color: "green",
    title: "Tailored to the role",
    description:
      "Paste a job description and the questions adapt to its responsibilities, skills, and the tradeoffs that role really cares about.",
  },
  {
    icon: Repeat,
    color: "orange",
    title: "Full interview loops",
    description:
      "Chain multiple rounds — screening, behavioral, technical — each scored against the right rubric, just like the real thing.",
  },
  {
    icon: Lightbulb,
    color: "pink",
    title: "Track real progress",
    description:
      "Per-dimension trends across sessions show exactly where you're improving and what to work on next.",
  },
] as const;

const STEPS = [
  {
    title: "Set up in seconds",
    description:
      "Describe what you're prepping for — or paste a job description — and pick a text or voice interviewer.",
  },
  {
    title: "Get interviewed",
    description:
      "Answer adaptive questions from an AI that follows up on your weak spots, exactly like a real interviewer.",
  },
  {
    title: "Review and improve",
    description:
      "See scored feedback, suggested answers, and progress trends — then run it again and watch your scores climb.",
  },
] as const;

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-slate-200/60 bg-white/90 backdrop-blur-xl shadow-soft">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold">ConvoTrainer</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8">
            <Link
              href="#features"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors duration-150"
            >
              Features
            </Link>
            <Link
              href="#how-it-works"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors duration-150"
            >
              How it works
            </Link>
            <Link
              href="#demo"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors duration-150"
            >
              Demo
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/auth/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/auth/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero with aurora background + live demo */}
      <section className="relative flex min-h-[calc(100vh-4rem)] items-center overflow-hidden py-12">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-[-6rem] top-[-4rem] h-72 w-72 rounded-full bg-blue-300/50 opacity-50 blur-3xl animate-aurora-drift motion-reduce:animate-none" />
          <div
            className="absolute right-[-4rem] top-[6rem] h-80 w-80 rounded-full bg-purple-300/50 opacity-50 blur-3xl animate-aurora-drift motion-reduce:animate-none"
            style={{ animationDelay: "-6s" }}
          />
          <div
            className="absolute bottom-[-6rem] left-[30%] h-72 w-72 rounded-full bg-indigo-300/40 opacity-50 blur-3xl animate-aurora-drift motion-reduce:animate-none"
            style={{ animationDelay: "-12s" }}
          />
        </div>

        <div className="mx-auto w-full max-w-7xl px-6">
          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-muted/50 bg-primary-subtle px-4 py-2 text-sm font-semibold text-primary shadow-soft">
                <Sparkles className="h-4 w-4" />
                <span>Your AI interview coach</span>
              </div>

              <div className="space-y-4">
                <h1 className="text-4xl font-bold leading-[1.15] tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
                  Practice interviews.
                  <br />
                  <span className="bg-linear-to-r from-primary to-primary-emphasis bg-clip-text text-transparent">
                    Get hired.
                  </span>
                </h1>
                <p className="max-w-xl text-lg leading-relaxed text-slate-600">
                  Rehearse real interview questions with an AI that adapts to
                  your answers, scores every response, and tells you exactly how
                  to improve — by voice or text, on your own schedule.
                </p>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <Button
                  size="lg"
                  asChild
                  className="shadow-soft-md transition-all duration-200 hover:shadow-soft-lg"
                >
                  <Link href="/auth/register">
                    Start practicing free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="transition-colors duration-150 hover:bg-slate-50"
                >
                  <Link href="#demo">See it in action</Link>
                </Button>
              </div>

              <div className="flex items-center gap-8 pt-4">
                <StatCounter value={2} label="Practice modes" />
                <div className="h-12 w-px bg-slate-200" />
                <StatCounter value={5} label="Interview round types" />
                <div className="h-12 w-px bg-slate-200" />
                <StatCounter value={100} suffix="%" label="Free in beta" />
              </div>

              <p className="text-sm font-medium text-slate-500">
                Free while in beta · No credit card required
              </p>
            </div>

            {/* Live, auto-playing demo */}
            <div className="lg:pl-4">
              <AnimatedDemo />
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal className="mb-16 space-y-4 text-center">
            <h2 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl md:text-5xl">
              Everything you need to walk in confident
            </h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600 md:text-xl">
              A complete loop: realistic questions, honest scoring, and the
              specific feedback that actually moves your performance.
            </p>
          </Reveal>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {FEATURES.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Reveal key={feature.title} delay={(index % 3) * 80}>
                  <Card
                    className={`h-full border border-slate-200/60 transition-all duration-200 hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:shadow-soft-md ${TILE_BORDERS[feature.color]}`}
                  >
                    <CardHeader>
                      <div
                        className={`mb-4 flex h-12 w-12 items-center justify-center rounded-lg ${TILE_COLORS[feature.color]}`}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <CardTitle className="mb-2 text-xl">
                        {feature.title}
                      </CardTitle>
                      <CardDescription className="text-base leading-relaxed">
                        {feature.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal className="mb-16 space-y-4 text-center">
            <h2 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl md:text-5xl">
              Start practicing in minutes
            </h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600 md:text-xl">
              No setup headaches — just pick what you&apos;re preparing for and
              start the conversation.
            </p>
          </Reveal>

          <div className="grid gap-8 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <Reveal
                key={step.title}
                delay={index * 100}
                className="space-y-4 text-center"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-muted text-2xl font-bold text-primary">
                  {index + 1}
                </div>
                <h3 className="text-xl font-semibold text-slate-900">
                  {step.title}
                </h3>
                <p className="leading-relaxed text-slate-600">
                  {step.description}
                </p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="demo" className="scroll-mt-20 bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <Reveal className="mb-12 space-y-4 text-center">
            <h2 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl md:text-5xl">
              See your score in 10 seconds
            </h2>
            <p className="mx-auto max-w-2xl text-lg leading-relaxed text-slate-600 md:text-xl">
              Answer a real interview question right here — no account needed —
              and get instant feedback on structure, specificity, and delivery.
            </p>
          </Reveal>
          <Reveal>
            <TryQuestion />
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-linear-to-br from-primary to-primary-emphasis py-24">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <Reveal>
            <h2 className="mb-6 text-3xl font-bold leading-tight text-white sm:text-4xl md:text-5xl">
              Your next interview starts here
            </h2>
            <p className="mx-auto mb-8 max-w-2xl text-lg leading-relaxed text-blue-50 md:text-xl">
              Practice the questions you&apos;ll actually be asked, get scored
              feedback, and walk in ready. Voice or text, on your schedule.
            </p>
            <Button size="lg" variant="secondary" asChild>
              <Link href="/auth/register">
                Get started — it&apos;s free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>

      <footer className="border-t bg-white py-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-col items-center gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <MessageSquare className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold">ConvoTrainer</span>
            </div>
            <nav className="flex items-center gap-6 text-sm text-slate-600">
              <Link
                href="#features"
                className="transition-colors duration-150 hover:text-slate-900"
              >
                Features
              </Link>
              <Link
                href="#how-it-works"
                className="transition-colors duration-150 hover:text-slate-900"
              >
                How it works
              </Link>
              <Link
                href="/auth/login"
                className="transition-colors duration-150 hover:text-slate-900"
              >
                Sign in
              </Link>
            </nav>
            <p className="text-sm text-slate-500">
              Built as a research project · Free while in beta
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
