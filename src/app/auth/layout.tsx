import Link from "next/link";
import { MessageSquare } from "lucide-react";

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
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center transition-transform group-hover:scale-105">
              <MessageSquare className="h-7 w-7" strokeWidth={2.5} />
            </div>
            <span className="text-3xl font-bold tracking-tight">
              ConvoTrainer
            </span>
          </Link>

          {/* Headline */}
          <div className="space-y-4">
            <h1 className="text-4xl font-bold leading-tight">
              Master Cross-Cultural Communication
            </h1>
            <p className="text-lg text-blue-100 leading-relaxed">
              Practice realistic conversations with AI personas and receive
              instant feedback to excel in global business settings.
            </p>
          </div>

          {/* Benefits */}
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
                <p className="font-semibold text-lg">50+ Realistic Scenarios</p>
                <p className="text-sm text-blue-100 mt-1">
                  From negotiations to feedback conversations
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
                <p className="font-semibold text-lg">8 Cultural Contexts</p>
                <p className="text-sm text-blue-100 mt-1">
                  Practice diverse communication styles
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
                <p className="font-semibold text-lg">Real-time Feedback</p>
                <p className="text-sm text-blue-100 mt-1">
                  Instant insights to improve every conversation
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane - Form Area */}
      <div className="flex items-center justify-center p-8 lg:p-12 bg-slate-50">
        {children}
      </div>
    </div>
  );
}
