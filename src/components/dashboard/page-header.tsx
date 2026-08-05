import { type ReactNode } from "react";
import { TILE_COLORS } from "@/lib/tile-colors";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  /** Color name used for the icon tile (matches Tailwind palette). */
  iconColor?:
    | "blue"
    | "purple"
    | "indigo"
    | "green"
    | "orange"
    | "pink"
    | "teal";
  actions?: ReactNode;
}

/**
 * Section hero used at the top of every dashboard page. Mirrors the
 * landing-page treatment: optional eyebrow + colored icon tile + bold title
 * + supporting description, with an actions slot on the right.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  icon,
  iconColor = "blue",
  actions,
}: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-start gap-4">
        {icon && (
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl shrink-0 ${TILE_COLORS[iconColor]}`}
          >
            {icon}
          </div>
        )}
        <div>
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
              {eyebrow}
            </p>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {title}
          </h1>
          {description && (
            <p className="mt-1 max-w-2xl text-gray-600 leading-relaxed">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
