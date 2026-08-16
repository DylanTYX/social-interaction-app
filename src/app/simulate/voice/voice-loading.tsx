import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Shown while the voice screen's chunk is downloading and again while its
 * session bootstrap resolves.
 *
 * Kept in its own module so `page.tsx` can render it without importing
 * `voice-session.tsx` — a static import there would pull the Azure Speech SDK
 * back into the server-render graph, which is exactly what the dynamic
 * `ssr: false` import is avoiding.
 */
export function VoiceLoadingFallback() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-50">
      <Card className="w-96">
        <CardHeader>
          <CardTitle>Initializing voice interview...</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            Setting up Azure speech recognition and synthesis.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
