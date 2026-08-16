"use client";

import { Check, MessageSquare, Mic } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { TILE_COLORS, type TileColor } from "@/lib/tile-colors";
import { cn } from "@/lib/utils";
import type { PracticeMode } from "@/lib/interview-setup";

/**
 * Text or voice, as two cards.
 *
 * This shape existed before and was cut in `3102d61` for good reasons: it was an
 * entire wizard step spent on a binary choice, wrapped in decorative gradients,
 * listing marketing-flavoured highlights. Collapsing it to a chip row fixed
 * that, but overcorrected — each mode was left with four words on a 32px pill.
 *
 * So the shape is back and the reasons it was cut are not.
 *
 * More to the point, the three lines under each mode are **consequences**, not
 * features, and every one of them is currently invisible in the UI:
 *
 *   - Voice returns `"prose"` unconditionally from `resolveAnswerFormat`
 *     (`interview-rounds.ts`), and `loop-step` hides the code-editor switch
 *     entirely when the round is not text. So picking Voice silently removes a
 *     capability, and today you find out one step later when a control you were
 *     expecting is simply absent.
 *   - Voice needs a microphone, and the mic check does not appear until the
 *     final step.
 *   - Voice rewrites `practiceMode` on every round in the loop.
 *
 * Saying so here costs one line each and prevents a wasted setup.
 */

interface ModeSpec {
  value: PracticeMode;
  title: string;
  description: string;
  /** Facts about this mode. Deliberately not styled as pros or cons. */
  points: string[];
  icon: typeof MessageSquare;
  accent: TileColor;
}

const MODES: ModeSpec[] = [
  {
    value: "text",
    title: "Text interview",
    description:
      "Type your answers and read the interviewer's replies. Easier to think before you commit.",
    points: [
      "Replies render as markdown, and you can re-read them",
      "Technical rounds can use a code editor",
      "Optional live streaming as the interviewer types",
    ],
    icon: MessageSquare,
    accent: "blue",
  },
  {
    value: "voice",
    title: "Voice interview",
    description:
      "Speak your answers and hear the interviewer reply. Closest to the real thing.",
    points: [
      "Needs a microphone — you check it on the last step",
      "You pick the interviewer's voice before starting",
      "No code editor: technical rounds are spoken instead",
    ],
    icon: Mic,
    accent: "purple",
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
    // Two mutually exclusive options, so radio semantics rather than
    // `ChoiceChip`'s `aria-pressed` — a pressed toggle does not tell a screen
    // reader that choosing one unchooses the other.
    <div
      role="radiogroup"
      aria-label="How do you want to answer?"
      className="grid gap-4 sm:grid-cols-2"
    >
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
              "flex h-full flex-col gap-3 rounded-xl border p-4 text-left transition-colors",
              "focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
              isActive
                ? "border-primary bg-primary-subtle"
                : "border-border bg-background hover:border-primary-border hover:bg-accent",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-lg",
                  TILE_COLORS[mode.accent],
                )}
                aria-hidden
              >
                <Icon className="h-4.5 w-4.5" />
              </div>
              {isActive && (
                <Badge variant="default" className="gap-1">
                  <Check className="h-3 w-3" />
                  Selected
                </Badge>
              )}
            </div>

            <div className="space-y-1.5">
              <p className="font-medium text-foreground">{mode.title}</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {mode.description}
              </p>
            </div>

            <ul className="space-y-1.5">
              {mode.points.map((point) => (
                <li
                  key={point}
                  className="flex gap-2 text-xs leading-5 text-muted-foreground"
                >
                  {/* A neutral dot, not a green tick. One of these lines is a
                      limitation, and ticking all three would read as three
                      benefits. */}
                  <span
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/60"
                    aria-hidden
                  />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}
