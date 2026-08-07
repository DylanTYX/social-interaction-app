import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),

  /**
   * The operator/product boundary, enforced rather than assumed.
   *
   * The measurement tooling — the eval harnesses, the price table, the shared
   * test fixtures — is developer-only, and today that is true purely because
   * nothing happens to import it. Next bundles what a route entrypoint reaches,
   * so one `import { MODEL_PRICING } from "@/lib/pricing"` inside a
   * `"use client"` component would put the OpenAI rate card in a public chunk,
   * with no error anywhere to notice it.
   *
   * `import "server-only"` would be the idiomatic guard, but the eval scripts
   * run under plain `tsx` outside Next's resolution conditions, so it risks
   * breaking the CLI. A lint rule cannot, and `npm run lint` already runs in CI.
   */
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/eval", "@/eval/*"],
              message:
                "The eval harnesses are developer tooling. They make billed OpenAI calls and must never reach a bundle — run them with `npm run eval`, `npm run eval:persona` or `npm run cost-report`.",
            },
            {
              group: ["@/lib/pricing"],
              message:
                "The OpenAI rate card is operator data, not product data. Importing it here would ship it to the browser. Cost belongs in `npm run cost-report`; see docs/DEMO.md, 'Who can see what'.",
            },
            {
              group: ["@/lib/test-support", "@/lib/test-support/*"],
              message:
                "Test fixtures must not ship in application code. Build the value where you need it, or move the helper into src/lib proper.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
