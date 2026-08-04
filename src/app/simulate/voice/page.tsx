"use client";

import dynamic from "next/dynamic";

import { VoiceLoadingFallback } from "./voice-loading";

/**
 * The voice screen is browser-only: it needs a microphone, a speaker, and the
 * Azure Speech SDK. Loading it with `ssr: false` keeps all of that out of the
 * server-render graph.
 *
 * Beyond being wasted work, server-rendering it caused a real build problem.
 * The Speech SDK's `package.json` has a `browser` field that stubs out its
 * Node-only certificate-checking dependencies (`async-disk-cache`, `ws`,
 * `tls`, …). Those substitutions are not applied when the module is resolved
 * for the server, so the SSR bundle pulled in the real `async-disk-cache` →
 * `istextorbinary` → `editions` → `errlop` chain, whose mixed CJS/ESM
 * packaging the bundler then warned about.
 *
 * Note this is a route entry point, so it stays a thin wrapper — the screen
 * itself lives in `./voice-session`. Importing anything from that module here
 * statically would defeat the whole arrangement.
 */
const VoiceSession = dynamic(() => import("./voice-session"), {
  ssr: false,
  loading: () => <VoiceLoadingFallback />,
});

export default function VoiceSimulatePage() {
  return <VoiceSession />;
}
