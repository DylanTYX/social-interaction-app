import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/supabase/server";
import { serverError, unauthorized } from "@/lib/api/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";

export const runtime = "nodejs";

/**
 * Mints a short-lived authorization token for the Azure Speech service so the
 * browser never has to see the raw subscription key.
 *
 * Token lifetime is ~10 minutes per the Azure docs:
 *   https://learn.microsoft.com/azure/ai-services/speech-service/rest-speech-to-text
 *
 * Reads from server-only env:
 *   - AZURE_SPEECH_KEY
 *   - AZURE_SPEECH_REGION
 *
 * The issued token is bearer-usable against Azure Speech directly, so this
 * endpoint requires an authenticated session and is rate limited per user.
 *
 * There is deliberately no `NEXT_PUBLIC_*` fallback. Next inlines those into
 * the client bundle, so accepting one here would let a misconfigured deploy
 * ship the raw subscription key to every browser — the exact failure this
 * endpoint exists to prevent. Missing server env is a loud 500 instead.
 */
export async function GET() {
  try {
    const { user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `speech-token:${user.id}`,
      RATE_LIMITS.speechToken,
    );
    if (limited) return limited;

    const subscriptionKey = process.env.AZURE_SPEECH_KEY;
    const region = process.env.AZURE_SPEECH_REGION;

    if (!subscriptionKey || !region) {
      return serverError(
        "GET /api/speech-token",
        new Error(
          "AZURE_SPEECH_KEY and/or AZURE_SPEECH_REGION are not set in the server environment.",
        ),
      );
    }

    const response = await fetch(
      `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issuetoken`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": subscriptionKey,
          "Content-Length": "0",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error(
        "[GET /api/speech-token] Azure rejected the token request:",
        response.status,
        detail,
      );
      return NextResponse.json(
        { error: "Speech service is unavailable right now." },
        { status: 502 },
      );
    }

    const token = await response.text();

    return NextResponse.json(
      {
        token,
        region,
        // ~9 minutes as a safety margin — the actual TTL is 10 minutes.
        expiresInSeconds: 9 * 60,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    return serverError("GET /api/speech-token", error);
  }
}
