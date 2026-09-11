import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { TILE_COLORS, type TileColor } from "@/lib/tile-colors";
import { cn } from "@/lib/utils";

/**
 * A score card that says something.
 *
 * Communication, STAR average and Duration each used to be a label and a bare
 * number, so three of the four report cards read as empty beside the one that
 * had a sentence. `detail` says the one thing to act on.
 *
 * Built exactly like the analytics page's stat cards — label left, tile right,
 * the same tile palette — so a number looks the same wherever the app shows
 * one. The label is sentence case on one line: an uppercase, letter-spaced label
 * beside an icon did not fit a fifth of the report's width, and "Communication"
 * was cut off.
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
    <Card className={cn("shadow-soft", className)}>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-600">{label}</p>
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              TILE_COLORS[color],
            )}
          >
            <Icon className="h-5 w-5" aria-hidden />
          </div>
        </div>
        <p className="text-3xl font-bold tabular-nums text-slate-900">{value}</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{detail}</p>
      </CardContent>
    </Card>
  );
}
