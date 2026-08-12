import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    /**
     * Node by default, jsdom for `.test.tsx`.
     *
     * The glob was `.test.ts` only, so a component or hook test could not be
     * *run* even if someone wrote one — the file was silently not collected.
     * That is why the two largest and most defect-prone files here,
     * `voice-session.tsx` and `chat/route.ts`, have no direct coverage, and it
     * is a fair part of why several of the bugs found in review reached a
     * commit at all.
     *
     * Most logic here is still better tested as a pure function in node — see
     * `silence-detection.ts`, extracted from the voice screen for exactly that
     * reason. This only removes the reason it *had* to be.
     */
    environment: "node",
    environmentMatchGlobs: [["**/*.test.tsx", "jsdom"]],
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
