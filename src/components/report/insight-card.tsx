import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TILE_COLORS, type TileColor } from "@/lib/tile-colors";
import { cn } from "@/lib/utils";

/** A solid accent per tile colour, for the bar down a card's left edge. */
export const ACCENT_BAR: Record<TileColor, string> = {
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  indigo: "bg-indigo-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  teal: "bg-teal-500",
};

/**
 * A score card that says something.
 *
 * Communication, STAR average and Duration each used to be a label and a bare
 * number, so three of the four report cards read as empty beside the one that
 * had a sentence. Colour says which kind of measure this is — the same tile
 * palette the dashboard uses — and `detail` says the one thing to act on.
 */
export function InsightCard({
  color,
  icon: Icon,
  label,
  value,
  detail,
  className,
}: {
  color: TileColor;
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  className?: string;
}) {
  return (
    <Card className={cn("relative overflow-hidden border-slate-200/80 bg-white", className)}>
      <div className={cn("absolute inset-y-0 left-0 w-1", ACCENT_BAR[color])} aria-hidden />
      <CardHeader className="pb-2">
        <CardTitle
          as="div"
          className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-slate-500"
        >
          <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", TILE_COLORS[color])}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        <p className="text-3xl font-bold tabular-nums text-slate-900">{value}</p>
        <p className="text-xs leading-relaxed text-slate-600">{detail}</p>
      </CardContent>
    </Card>
  );
}
