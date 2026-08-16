import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Local alias kept so the shaped skeletons below stay terse. The block itself
 *  now lives in `ui/skeleton.tsx`, shared with the pages that used to hand-roll
 *  their own. */
function Pulse({ className }: { className: string }) {
  return <Skeleton className={className} />;
}

function SessionRowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl p-4">
      <Pulse className="h-10 w-10 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Pulse className="h-4 w-2/5 max-w-xs" />
        <Pulse className="h-3 w-3/5 max-w-sm" />
      </div>
      <Pulse className="h-8 w-12 shrink-0" />
    </div>
  );
}

export function SessionListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <SessionRowSkeleton key={index} />
      ))}
    </div>
  );
}

function PersonaCardSkeleton() {
  return (
    <Card className="border border-slate-200/60">
      <CardHeader>
        <div className="flex items-start gap-4">
          <Pulse className="h-14 w-14 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Pulse className="h-5 w-2/3" />
            <Pulse className="h-3 w-1/2" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Pulse className="h-3 w-full" />
        <Pulse className="h-3 w-4/5" />
        <div className="flex gap-2">
          <Pulse className="h-6 w-16" />
          <Pulse className="h-6 w-16" />
          <Pulse className="h-6 w-16" />
        </div>
      </CardContent>
    </Card>
  );
}

export function PersonaGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <PersonaCardSkeleton key={index} />
      ))}
    </div>
  );
}

/**
 * A placeholder for one saved-document row.
 *
 * Shaped to the row it stands in for, which the previous version was not: it
 * had no leading icon tile, three text lines where the row has two, and `p-4`
 * against the row's `p-3` — so the list visibly resettled when the fetch
 * landed. A skeleton that does not match its content is worse than none, since
 * it promises a layout and then breaks it.
 *
 * Serves both job descriptions and resumes. They render identical rows, but
 * only one of them used a shared component; the other hand-rolled three grey
 * blocks.
 */
function DocumentRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
      <Pulse className="h-9 w-9 shrink-0 rounded-lg" />
      <div className="flex-1 space-y-2">
        <Pulse className="h-4 w-1/2 max-w-xs" />
        <Pulse className="h-3 w-2/3 max-w-md" />
      </div>
      <Pulse className="h-8 w-8 shrink-0 rounded-md" />
    </div>
  );
}

/** Three document rows, the count both list pages were already hard-coding. */
export function DocumentListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, index) => (
        <DocumentRowSkeleton key={index} />
      ))}
    </div>
  );
}
