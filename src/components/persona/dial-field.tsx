"use client";

import { HelpCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * One persona dial: a 1-10 range with a tooltip explaining which way is which.
 *
 * Extracted from the setup wizard, where it was a local `SliderField`, because
 * the persona library editor had grown its own version of the same control —
 * bare `<input type="number">` boxes with no helper and no value readout. Two
 * implementations of one control, and the worse one was on the page whose
 * whole job is editing dials. One component, both surfaces.
 */
export function DialField({
  label,
  value,
  helper,
  onChange,
}: {
  label: string;
  value: number;
  helper: string;
  onChange: (next: number) => void;
}) {
  // A <Label> with no `htmlFor` next to an <input> with no `id` is decoration:
  // it looks associated and is not. Wiring them means the dials are actually
  // reachable and announced.
  const id = `dial-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={id}>{label}</Label>
          {/* The one place a tooltip earns its keep: "higher means more
              skepticism" is real explanation, not a restated label, and it is
              the kind of detail you want once and never again.

              `aria-describedby` carries the same text to screen readers and to
              anyone who reaches the slider by keyboard, so the explanation is
              never hover-only. */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`What does ${label.toLowerCase()} do?`}
                className="text-muted-foreground hover:text-muted-foreground"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-56">{helper}</TooltipContent>
          </Tooltip>
        </div>
        <Badge variant="secondary" className="text-xs px-2 py-0.5">
          {value}/10
        </Badge>
      </div>
      <input
        id={id}
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        aria-valuetext={`${value} out of 10`}
        aria-describedby={`${id}-help`}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
      />
      <span id={`${id}-help`} className="sr-only">
        {helper}
      </span>
    </div>
  );
}

/**
 * The six dials, with the helper text both surfaces show. Declared once so the
 * wizard's tooltip and the library editor's tooltip cannot say different
 * things about the same slider.
 */
export const PERSONA_DIALS = [
  {
    key: "strictness",
    label: "Strictness",
    helper: "Higher means more demanding and less forgiving.",
  },
  {
    key: "warmth",
    label: "Warmth",
    helper: "Higher means more encouraging and supportive.",
  },
  {
    key: "pace",
    label: "Pace",
    helper: "Higher means faster, less breathing room between questions.",
  },
  {
    key: "pushback",
    label: "Pushback",
    helper:
      "Higher means more skepticism — challenges claims and probes for evidence.",
  },
  {
    key: "probingDepth",
    label: "Probing depth",
    helper:
      "Higher means every vague claim — 'helped with', 'we decided' — gets a follow-up.",
  },
  {
    key: "unpredictability",
    label: "Unpredictability",
    helper:
      "Higher means more curveballs — topic pivots and what-if twists on your own scenario.",
  },
] as const;

export type PersonaDialKey = (typeof PERSONA_DIALS)[number]["key"];
