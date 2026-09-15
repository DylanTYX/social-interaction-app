import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * The sign-in and create-account frame.
 *
 * Left, on large screens: a navy panel holding two things, the wordmark at
 * the top and the product's one-line promise anchored at the bottom. Navy
 * because that is where the landing page ends — its closing section is navy
 * and its button leads here — so the two screens read as one step. The
 * headline is the landing page's own, word for word.
 *
 * The panel is deliberately almost empty. Anyone on this screen has already
 * decided to sign in or sign up; they read the pitch on the way here. A lede,
 * a product mock and a footer line were a second landing page competing with
 * the form, which is the only thing on this screen with a job to do.
 *
 * Right: the form, on white, with no card around it. A single form on an
 * otherwise empty pane does not need a border to say it is one thing.
 * See docs/DESIGN.md.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-navy p-12 text-white lg:flex xl:p-16">
        <Link
          href="/"
          className="self-start font-display text-2xl font-bold tracking-[-0.02em] text-white"
        >
          Convo<span className="text-blue-300">Trainer</span>
        </Link>

        {/* Anchored to the bottom edge, so the empty navy above it is the
            composition rather than leftover space. */}
        <p className="max-w-[15ch] font-display text-[clamp(2.5rem,3.6vw,3.5rem)] leading-[1.04] font-bold tracking-[-0.03em] text-balance">
          Practice with an interviewer who follows up.
        </p>
      </aside>

      {/* Carries its own way back to the landing page, at every breakpoint:
          below `lg` the brand panel and its link are hidden, and the form
          would otherwise be a dead end. */}
      <main className="relative flex flex-col items-center justify-center px-6 py-20">
        <Link
          href="/"
          className="absolute top-6 left-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors duration-150 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to home
        </Link>
        <div className="w-full max-w-sm">
          <p className="mb-10 font-display text-2xl font-bold tracking-[-0.02em] text-navy lg:hidden">
            Convo<span className="text-primary">Trainer</span>
          </p>
          {children}
        </div>
      </main>
    </div>
  );
}
