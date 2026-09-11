import { Suspense } from "react";

import { CompareSessions } from "./compare-sessions";

/** `useSearchParams` needs a Suspense boundary to render. */
export default function CompareSessionsPage() {
  return (
    <Suspense fallback={null}>
      <CompareSessions />
    </Suspense>
  );
}
