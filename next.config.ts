import type { NextConfig } from "next";

/**
 * Baseline security headers applied to every response.
 *
 * Deliberately omitted for now: `Content-Security-Policy`. The Azure Speech
 * SDK opens websockets to region-specific hosts and the correct allow-list
 * depends on the configured region, so a CSP needs to be written against a
 * real deployment rather than guessed at here. Add it once the voice flow's
 * outbound origins have been inventoried.
 */
const securityHeaders = [
  // No embedding — this app has no legitimate iframe use case.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // `microphone=(self)` is required: voice practice records the candidate.
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), browsing-topics=(), microphone=(self)",
  },
  // Only meaningful over HTTPS; ignored by browsers on plain-HTTP localhost.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

/**
 * Hosts permitted to request Next's dev-only internals (`/_next/*`, the
 * webpack HMR socket). Consulted by `next dev` only — it has no effect on a
 * production build, and it is not a substitute for the auth checks on
 * `/api/*`.
 *
 * Needed whenever the dev server is opened from something other than
 * localhost — typically another device on the same network, e.g. a phone
 * testing the voice flow against `http://<your-lan-ip>:3000`.
 *
 * A LAN IP changes with the network, so rather than editing this file each
 * time, extra origins can be passed in:
 *
 *   NEXT_DEV_ORIGINS=192.168.1.42,10.0.0.5 npm run dev
 */
const allowedDevOrigins = [
  "172.20.10.2",
  "172.20.10.4",
  "192.168.0.29",
  ...(process.env.NEXT_DEV_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? []),
];

const nextConfig: NextConfig = {
  allowedDevOrigins,
  async redirects() {
    return [
      {
        source: "/simulate/report",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
