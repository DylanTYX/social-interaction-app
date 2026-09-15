import { type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The frame every app page shares: one container, one header, and a section
 * heading for the groups below it. See docs/DESIGN.md, "App screens".
 *
 * The header used to take an eyebrow and a coloured icon tile. Both went. The
 * tile spent a round colour on a page (Analytics was orange, Sessions indigo,
 * Personas purple), which is the one thing those colours must not do, and the
 * eyebrow was a different arbitrary word on every page — "Insights", "History",
 * "Library", "Account" — that restated the sidebar. The title now names the
 * page the way the sidebar does, and that is the whole header.
 */

/**
 * The page body. Caps the width on very wide screens at the same 1180px the
 * landing page uses, and sets the one gutter and the one vertical rhythm.
 */
export function PageContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("mx-auto w-full max-w-295 space-y-8 p-6 lg:p-8", className)}
    >
      {children}
    </div>
  );
}

/**
 * A page's title, one line on what the page is for, and the page's actions.
 * The title names the page as the sidebar does; only the home page greets
 * instead.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight text-balance text-slate-900">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-base leading-relaxed text-pretty text-slate-600">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </header>
  );
}

/** A group heading within a page, with an optional link to the page that owns it. */
export function SectionHeader({
  title,
  link,
}: {
  title: string;
  link?: { label: string; href: string };
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      {link && (
        <Link
          href={link.href}
          className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {link.label}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}

/**
 * A small uppercase label for a panel inside a card: a column head, a group
 * within a card, a data readout. Not for use above a page or section heading.
 */
export const PANEL_LABEL =
  "text-xs font-semibold tracking-wide text-slate-500 uppercase";
