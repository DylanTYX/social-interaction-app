import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * 404. Reachable by typing a bad URL, but the realistic route here is a stale
 * link to a deleted session or report, so the copy points at the two places
 * worth going next rather than just saying "not found".
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary-muted text-primary">
          <Compass className="h-6 w-6" />
        </div>
        <h1 className="mt-4 text-xl font-semibold text-slate-900">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          The link may be out of date, or the session it pointed to was deleted.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/sessions">Browse my sessions</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
