import type { ReactNode } from "react";

/**
 * One headline number. Shared by the dashboard home and Analytics, which used
 * to draw these separately, each with a coloured icon tile, in four different
 * round colours. The number is the information; the tile was decoration.
 *
 * The value is set the way every large number in the app is: display face,
 * navy, tabular figures. See docs/DESIGN.md.
 */
export function StatTile({
  label,
  value,
  caption,
}: {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-soft">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 font-display text-3xl leading-none font-bold tracking-tight text-navy tabular-nums">
        {value}
      </p>
      {caption && <p className="mt-2 text-xs text-slate-500">{caption}</p>}
    </div>
  );
}
