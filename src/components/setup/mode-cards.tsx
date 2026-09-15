"use client";

import { MessageSquare, Mic } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PracticeMode } from "@/lib/interview-setup";

/**
 * Voice or text, with voice first.
 *
 * Voice is the primary way to practise: an interview is spoken, and a practice
 * tool that defaults to typing trains the half of the skill nobody is assessed
 * on. So the two are no longer equal cards side by side. Voice leads, says it
 * is recommended, and says what it needs; text is the second row, for when you
 * want time to think or cannot speak aloud.
 *
 * Drawn as the same radio rows the document pickers use, so choosing how to
 * answer looks like every other single choice in the wizard. The lines under
 * each option are consequences you would otherwise discover later, not
 * features.
 */

interface ModeSpec {
  value: PracticeMode;
  title: string;
  description: string;
  detail: string;
  icon: typeof MessageSquare;
  recommended?: boolean;
}

const MODES: ModeSpec[] = [
  {
    value: "voice",
    title: "Voice interview",
    description:
      "Speak your answers and hear the interviewer reply. Closest to the real thing.",
    detail:
      "Your microphone is checked when you start. Technical rounds still have a code editor for the code.",
    icon: Mic,
    recommended: true,
  },
  {
    value: "text",
    title: "Text interview",
    description:
      "Type your answers and read the replies. More time to think before you commit.",
    detail: "Technical rounds open straight into a code editor.",
    icon: MessageSquare,
  },
];

export function ModeCards({
  value,
  onChange,
}: {
  value: PracticeMode;
  onChange: (mode: PracticeMode) => void;
}) {
  return (
    // Radio semantics: choosing one unchooses the other, which a pressed
    // toggle would not tell a screen reader.
    <div role="radiogroup" aria-label="How you'll answer" className="space-y-2">
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const isActive = value === mode.value;

        return (
          <button
            key={mode.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(mode.value)}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors duration-150",
              "outline-none focus-visible:ring-[3px] focus-visible:ring-primary-muted",
              isActive
                ? "border-primary-border bg-primary-subtle"
                : "border-slate-200 bg-white hover:bg-slate-50",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
                isActive
                  ? "border-primary bg-primary"
                  : "border-slate-300 bg-white",
              )}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            <span className="min-w-0 flex-1 space-y-1">
              <span className="flex flex-wrap items-center gap-2">
                <Icon
                  className={cn(
                    "h-4 w-4",
                    isActive ? "text-primary" : "text-slate-500",
                  )}
                  aria-hidden
                />
                <span className="font-display font-semibold text-slate-900">
                  {mode.title}
                </span>
                {mode.recommended && (
                  <Badge variant="outline" className="bg-white">
                    Recommended
                  </Badge>
                )}
              </span>
              <span className="block text-sm leading-6 text-slate-600">
                {mode.description}
              </span>
              <span className="block text-xs leading-5 text-slate-500">
                {mode.detail}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
