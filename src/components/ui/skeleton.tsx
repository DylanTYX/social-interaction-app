import { cn } from "@/lib/utils";

/**
 * A loading placeholder block.
 *
 * This existed already, eight times over: `page-skeletons.tsx` kept a private
 * `Pulse`, and every other loading state hand-wrote `animate-pulse rounded-lg
 * bg-slate-100` inline. The copies had drifted — some were `bg-slate-100`, some
 * `bg-slate-100`, some `bg-muted`, with three different radii — so loading
 * states looked subtly different depending on which page you were on.
 *
 * The pulse deliberately survives `prefers-reduced-motion` at a slower rate
 * (see globals.css): a skeleton that does not move is indistinguishable from
 * content that failed to render.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-lg bg-slate-100", className)}
      {...props}
    />
  );
}

export { Skeleton };
