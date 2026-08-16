import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";
import { initialsFromName } from "@/lib/format";
import { TILE_COLORS, tileColorForKey } from "@/lib/tile-colors";

interface ChatMessageProps {
  role: "user" | "ai";
  content: string;
  timestamp?: string;
  personaName?: string;
  feedbackHint?: string | null;
  feedbackTone?: "positive" | "constructive" | "neutral";
  feedbackLoading?: boolean;
  /** Voice delivery summary (pace, fillers, pauses) shown under user turns. */
  deliveryNote?: string | null;
}

const FEEDBACK_TONE_CLASS: Record<
  NonNullable<ChatMessageProps["feedbackTone"]>,
  string
> = {
  positive: "border-success-border bg-success-subtle text-success-emphasis",
  constructive: "border-warning-border bg-warning-subtle text-warning-emphasis",
  neutral: "border-slate-200 bg-slate-50 text-slate-700",
};

/**
 * Hoisted out of the component on purpose.
 *
 * These twenty renderers close over nothing, and rebuilding the object every
 * render handed `ReactMarkdown` a new `components` prop each time — which
 * matters here more than it looks: streaming calls `setMessages` once per
 * token, so the whole transcript re-rendered and re-parsed its markdown on
 * every chunk of every reply.
 */
const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="mb-4 text-xl font-semibold tracking-tight text-slate-950 last:mb-0">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="mb-3.5 text-lg font-semibold tracking-tight text-slate-950 last:mb-0">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="mb-3 text-base font-semibold text-slate-950 last:mb-0">
      {children}
    </h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700 last:mb-0">
      {children}
    </h4>
  ),
  h5: ({ children }: { children?: React.ReactNode }) => (
    <h5 className="mb-2 text-sm font-semibold text-slate-800 last:mb-0">
      {children}
    </h5>
  ),
  h6: ({ children }: { children?: React.ReactNode }) => (
    <h6 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 last:mb-0">
      {children}
    </h6>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="mb-4 last:mb-0 leading-relaxed">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="mb-4 list-disc space-y-2 pl-5 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="mb-4 list-decimal space-y-2 pl-5 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="leading-relaxed">{children}</li>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="mb-4 border-l-2 border-slate-300 pl-3 italic text-slate-600 last:mb-0">
      {children}
    </blockquote>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="font-medium text-primary underline underline-offset-2 hover:text-primary-emphasis"
    >
      {children}
    </a>
  ),
  code: ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => {
    const isInline = !className;

    if (isInline) {
      return (
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-900">
          {children}
        </code>
      );
    }

    return (
      <code className="block overflow-x-auto rounded-xl bg-slate-950 px-4 py-3 font-mono text-sm text-slate-100">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="mb-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-sm text-slate-100 last:mb-0">
      {children}
    </pre>
  ),
};

/**
 * One transcript bubble.
 *
 * Memoised, and that is load-bearing rather than housekeeping. Streaming calls
 * `setMessages` once per SSE chunk, so without this every settled bubble in the
 * transcript re-rendered — and re-parsed its markdown — on every token of every
 * reply. The hoisted `markdownComponents` above cut the cost of each of those
 * renders; this removes the renders. Every prop is a primitive, so the default
 * shallow comparison is exactly right.
 *
 * It also makes the entrance animation below viable: an un-memoised bubble is
 * fine with CSS animations (a re-render does not restart one), but the profiler
 * work needed to keep the streaming path smooth has to happen first regardless.
 */
export const ChatMessage = memo(function ChatMessage({
  role,
  content,
  timestamp,
  personaName = "AI Assistant",
  feedbackHint,
  feedbackTone = "neutral",
  feedbackLoading = false,
  deliveryNote,
}: ChatMessageProps) {
  const isUser = role === "user";

  const displayName = isUser ? "You" : personaName;
  const initials = isUser ? "You" : initialsFromName(personaName);

  return (
    <div
      className={cn(
        "flex gap-3 items-start",
        isUser && "flex-row-reverse",
        // Only the user's own turn animates in. It has a genuine discrete
        // mount — you press send and it appears — whereas the interviewer's
        // bubble mounts empty and then fills token by token, so an entrance
        // there would play against an empty box and fight the autoscroll.
        isUser && "animate-in fade-in-0 slide-in-from-bottom-2 duration-200",
      )}
    >
      {/* Avatar.
          The interviewer's is keyed to their *name*, the same way
          `InitialsAvatar` does it on the personas page, in the session list and
          in the picker — so Sarah Chen is the same colour in the transcript as
          everywhere else. It used to be hardcoded purple, which made every
          interviewer look identical here and unrelated to their own colour one
          screen away. The candidate stays primary: that is the app speaking as
          you, not a persona. */}
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold",
          isUser
            ? "bg-primary text-primary-foreground"
            : TILE_COLORS[tileColorForKey(personaName)],
        )}
      >
        {initials}
      </div>

      {/* Message Content */}
      <div className={cn("flex flex-col max-w-[75%]", isUser && "items-end")}>
        <div className="flex items-baseline gap-2 mb-1">
          <span
            className={cn(
              "text-xs font-medium",
              isUser ? "text-primary-emphasis" : "text-slate-700",
            )}
          >
            {displayName}
          </span>
          {timestamp && (
            <span className="text-[10px] text-muted-foreground">
              {timestamp}
            </span>
          )}
        </div>

        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 shadow-soft",
            isUser
              ? "bg-primary text-white rounded-tr-sm"
              : "bg-white text-slate-900 border border-slate-200/80 rounded-tl-sm",
          )}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {content}
            </p>
          ) : (
            <div className="space-y-4 text-sm leading-relaxed [&_hr]:my-5 [&_hr]:border-slate-200 [&_h1]:mt-2 [&_h2]:mt-2 [&_h3]:mt-1.5 [&_h4]:mt-1.5 [&_h5]:mt-1 [&_h6]:mt-1">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={markdownComponents}
              >
                {content || " "}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {isUser && (feedbackLoading || feedbackHint) && (
          <p
            // Keyed on the state so React swaps the element rather than
            // mutating it in place. Without the key the settled chip inherits
            // the placeholder's DOM node, and a CSS entrance on a node that is
            // already on screen never plays.
            key={feedbackLoading ? "pending" : "settled"}
            className={cn(
              "mt-1.5 max-w-full rounded-lg border px-3 py-1.5 text-xs leading-relaxed",
              feedbackLoading
                ? // `animate-breathe` and `animate-in` both write the
                  // `animation` shorthand, so they cannot be combined — the
                  // placeholder breathes, the settled chip fades in.
                  "animate-breathe border-slate-200 bg-slate-50 text-slate-500"
                : cn(
                    "animate-in fade-in-0 slide-in-from-top-1 duration-200",
                    FEEDBACK_TONE_CLASS[feedbackTone ?? "neutral"],
                  ),
            )}
          >
            {feedbackLoading ? "Coach is reviewing your answer…" : feedbackHint}
          </p>
        )}

        {isUser && deliveryNote && (
          <p className="mt-1.5 flex animate-in items-center gap-1.5 rounded-lg border border-primary-border bg-primary-subtle px-3 py-1.5 text-xs font-medium text-primary-emphasis fade-in-0 slide-in-from-top-1 duration-200">
            <span aria-hidden="true">🎙️</span>
            {deliveryNote}
          </p>
        )}
      </div>
    </div>
  );
});
