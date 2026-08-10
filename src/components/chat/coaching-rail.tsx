"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LiveFeedbackSidebar } from "@/components/chat/live-feedback-sidebar";
import { cn } from "@/lib/utils";
import type { InterviewTurnState } from "@/hooks/use-interview-turn-state";

/**
 * The collapsible live-coaching rail on the right of both interview screens.
 *
 * Extracted because the text and voice pages carried identical copies of it,
 * down to the same `-left-4` offset on the toggle — and it needed a change that
 * would otherwise have had to be made twice.
 *
 * That change: the rail now animates its width instead of swapping a 26rem
 * panel for a 12px strip in a single frame. The panel stays mounted across the
 * transition, marked `inert` while collapsed so it is neither focusable nor
 * announced — collapsing is a request to get it out of the way, not a request
 * to keep it in the tab order behind a clipped edge.
 *
 * Hidden below `xl` entirely, which is a real gap rather than a decision: on a
 * phone or tablet the live coaching is unreachable, not collapsed. Out of scope
 * here, but it is the reason this component takes no responsive props.
 */
export function CoachingRail({
  open,
  onOpenChange,
  turn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  turn: InterviewTurnState;
}) {
  return (
    <div
      className={cn(
        "relative hidden shrink-0 overflow-hidden border-l border-slate-200/80 transition-[width] duration-300 ease-soft xl:block",
        open ? "w-112 bg-transparent" : "w-12 bg-white/80 backdrop-blur",
      )}
    >
      {/* Kept mounted so the panel is revealed and clipped by the animating
          width rather than blinking in at the end of it. `inert` covers both
          focus and the accessibility tree in one attribute. */}
      <div
        inert={!open}
        aria-hidden={!open}
        className={cn(
          // 28rem: the panel's 26rem plus this container's 1rem of padding on
          // each side, so the open width is exactly what the content needs.
          "h-full w-112 p-4 transition-opacity duration-200 ease-soft",
          open ? "opacity-100 delay-100" : "opacity-0",
        )}
      >
        <LiveFeedbackSidebar
          metrics={turn.metrics}
          analyses={turn.analyses}
          followupPrompt={turn.lastFollowupPrompt}
        />
      </div>

      {/* One button that moves, rather than two that swap. Straddles the left
          border when open; centred in the strip when collapsed. */}
      <Button
        variant="ghost"
        size="icon-sm"
        className={cn(
          "absolute top-1/2 z-10 -translate-y-1/2 rounded-full border border-slate-200 bg-white shadow-soft",
          "transition-[left] duration-300 ease-soft",
          open ? "left-0 -translate-x-1/2" : "left-1/2 -translate-x-1/2",
        )}
        onClick={() => onOpenChange(!open)}
        aria-label={open ? "Collapse live coaching" : "Expand live coaching"}
        aria-expanded={open}
      >
        {open ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
