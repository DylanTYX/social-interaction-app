import Link from "next/link";
import { ArrowLeft, MessageSquare } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left Pane — the brand panel. One hue: this is the first screen a new
          user sees, and it used to run blue→purple→indigo, which taught them
          the brand colour was "a gradient" before the app taught them it was
          blue. */}
      <div className="hidden lg:flex flex-col justify-center items-center bg-linear-to-br from-primary to-primary-emphasis p-12 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        <div className="relative z-10 max-w-md space-y-8 text-white">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center transition-transform group-hover:scale-105">
              <MessageSquare className="h-7 w-7" strokeWidth={2.5} />
            </div>
            <span className="text-3xl font-bold tracking-tight">
              ConvoTrainer
            </span>
          </Link>

          {/* The landing page's own pitch, not a second one. This panel used
              to sell "cross-cultural communication" and "50+ scenarios" — the
              product this app grew out of, not the product the page behind
              the Sign in button describes. First screen a new user sees; it
              should describe the app they are signing into. */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight">
              Practice interviews. Get hired.
            </h1>
            <p className="text-lg text-blue-100 leading-relaxed">
              Rehearse real interview questions with an AI that adapts to your
              answers, scores every response, and tells you exactly how to
              improve — by voice or text, on your own schedule.
            </p>
          </div>

          <div className="space-y-4 pt-4">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-lg">Adaptive questioning</p>
                <p className="text-sm text-blue-100 mt-1">
                  Every answer changes what gets asked next
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-lg">
                  Scored, specific feedback
                </p>
                <p className="text-sm text-blue-100 mt-1">
                  Per-answer scores, targeted tips, and a suggested answer
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-lg">Voice or text</p>
                <p className="text-sm text-blue-100 mt-1">
                  Speak your answers and get delivery feedback too
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane - Form Area.

          Carries its own way back to the landing page. The brand panel's logo
          links home, but that whole panel is `hidden lg:flex` — below a laptop
          screen it disappears and took the only exit with it, leaving the auth
          pages a dead end. The form side owns the link now, so it exists at
          every breakpoint and does not depend on knowing that logos are
          clickable. */}
      <div className="relative flex items-center justify-center bg-slate-50 p-8 lg:p-12">
        <Link
          href="/"
          className="absolute left-6 top-6 inline-flex items-center gap-1.5 text-sm text-slate-500 transition-colors duration-150 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
        {children}
      </div>
    </div>
  );
}
