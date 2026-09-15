import Link from "next/link";

import { Button } from "@/components/ui/button";

interface Action {
  label: string;
  href?: string;
  onClick?: () => void;
}

/**
 * Nothing here yet, or nothing matches.
 *
 * A dashed box rather than a `Card`, so it sits correctly both on a page and
 * inside a card — the library pages render it inside their "Saved" card, and
 * a card inside a card is two borders saying the same thing. The icon tile it
 * used to lead with went for the same reason every icon tile went: it carried
 * no information the title did not. See docs/DESIGN.md.
 */
export function EmptyStateCard({
  title,
  description,
  primaryAction,
  secondaryAction,
}: {
  title: string;
  description?: string;
  primaryAction?: Action;
  secondaryAction?: Action;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
      <h2 className="font-display text-lg font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      {description && (
        <p className="mx-auto mt-1.5 max-w-md text-sm text-balance text-slate-500">
          {description}
        </p>
      )}
      {(primaryAction || secondaryAction) && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {primaryAction && <ActionButton action={primaryAction} />}
          {secondaryAction && (
            <ActionButton action={secondaryAction} variant="outline" />
          )}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  action,
  variant = "default",
}: {
  action: Action;
  variant?: "default" | "outline";
}) {
  if (action.href) {
    return (
      <Button variant={variant} asChild>
        <Link href={action.href}>{action.label}</Link>
      </Button>
    );
  }
  return (
    <Button type="button" variant={variant} onClick={action.onClick}>
      {action.label}
    </Button>
  );
}
