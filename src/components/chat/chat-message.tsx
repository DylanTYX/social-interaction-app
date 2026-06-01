import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

interface ChatMessageProps {
  role: "user" | "ai";
  content: string;
  timestamp?: string;
  personaName?: string;
}

export function ChatMessage({
  role,
  content,
  timestamp,
  personaName = "AI Assistant",
}: ChatMessageProps) {
  const isUser = role === "user";
  const markdownComponents = {
    h1: ({ children }: { children?: React.ReactNode }) => (
      <h1 className="mb-4 text-xl font-semibold tracking-tight text-slate-950 last:mb-0 dark:text-slate-50">
        {children}
      </h1>
    ),
    h2: ({ children }: { children?: React.ReactNode }) => (
      <h2 className="mb-3.5 text-lg font-semibold tracking-tight text-slate-950 last:mb-0 dark:text-slate-50">
        {children}
      </h2>
    ),
    h3: ({ children }: { children?: React.ReactNode }) => (
      <h3 className="mb-3 text-base font-semibold text-slate-950 last:mb-0 dark:text-slate-50">
        {children}
      </h3>
    ),
    h4: ({ children }: { children?: React.ReactNode }) => (
      <h4 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-700 last:mb-0 dark:text-slate-200">
        {children}
      </h4>
    ),
    h5: ({ children }: { children?: React.ReactNode }) => (
      <h5 className="mb-2 text-sm font-semibold text-slate-800 last:mb-0 dark:text-slate-200">
        {children}
      </h5>
    ),
    h6: ({ children }: { children?: React.ReactNode }) => (
      <h6 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600 last:mb-0 dark:text-slate-300">
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
      <blockquote className="mb-4 border-l-2 border-slate-300 pl-3 italic text-slate-600 last:mb-0 dark:border-slate-700 dark:text-slate-300">
        {children}
      </blockquote>
    ),
    a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
      <a
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        className="font-medium text-blue-600 underline underline-offset-2 hover:text-blue-700"
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
          <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.85em] text-slate-900 dark:bg-slate-800 dark:text-slate-100">
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

  // Extract initials from persona name
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const displayName = isUser ? "You" : personaName;
  const initials = isUser ? "You" : getInitials(personaName);

  return (
    <div className={cn("flex gap-3 items-start", isUser && "flex-row-reverse")}>
      {/* Avatar */}
      <div
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold",
          isUser ? "bg-blue-600 text-white" : "bg-purple-100 text-purple-700",
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
              isUser ? "text-blue-700" : "text-gray-700",
            )}
          >
            {displayName}
          </span>
          {timestamp && (
            <span className="text-[10px] text-gray-400">{timestamp}</span>
          )}
        </div>

        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 shadow-soft",
            isUser
              ? "bg-blue-600 text-white rounded-tr-sm"
              : "bg-white text-gray-900 border border-gray-200/80 rounded-tl-sm",
          )}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {content}
            </p>
          ) : (
            <div className="space-y-4 text-sm leading-relaxed [&_hr]:my-5 [&_hr]:border-slate-200 dark:[&_hr]:border-slate-800 [&_h1]:mt-2 [&_h2]:mt-2 [&_h3]:mt-1.5 [&_h4]:mt-1.5 [&_h5]:mt-1 [&_h6]:mt-1">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkBreaks]}
                components={markdownComponents}
              >
                {content || " "}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
