import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Pulse({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className}`} />;
}

export function SessionRowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200/70 bg-white p-4">
      <Pulse className="h-11 w-11 shrink-0 rounded-full" />
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

export function PersonaCardSkeleton() {
  return (
    <Card className="border border-gray-200/60">
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

export function JobDescriptionRowSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200/70 bg-white p-4">
      <div className="flex-1 space-y-2">
        <Pulse className="h-4 w-1/3 max-w-xs" />
        <Pulse className="h-3 w-2/3 max-w-md" />
        <Pulse className="h-3 w-24" />
      </div>
      <Pulse className="h-9 w-9 shrink-0 rounded-md" />
    </div>
  );
}

export function DashboardStatSkeleton() {
  return (
    <Card className="border border-gray-200/80">
      <CardContent className="space-y-2 py-6">
        <Pulse className="h-3 w-20" />
        <Pulse className="h-8 w-16" />
        <Pulse className="h-3 w-28" />
      </CardContent>
    </Card>
  );
}
