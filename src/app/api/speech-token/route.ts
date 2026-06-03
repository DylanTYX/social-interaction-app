import { NextResponse } from "next/server";

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
 * For backward compatibility, if those are missing we also accept the
 * legacy NEXT_PUBLIC_* variants (so existing deployments do not break the
 * moment they pull these changes). New deployments should configure the
 * server-only variables.
 */
export async function GET() {
  const subscriptionKey =
    process.env.AZURE_SPEECH_KEY ?? process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY;
  const region =
    process.env.AZURE_SPEECH_REGION ??
    process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION;

  if (!subscriptionKey || !region) {
    return NextResponse.json(
      {
        error:
          "Speech credentials are not configured. Set AZURE_SPEECH_KEY and AZURE_SPEECH_REGION in the server environment.",
      },
      { status: 500 },
    );
  }

  try {
    const response = await fetch(
      `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issuetoken`,
      {
        method: "POST",
        headers: {
          "Ocp-Apim-Subscription-Key": subscriptionKey,
          "Content-Length": "0",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        // 10s upper bound — Azure issues tokens almost immediately.
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      return NextResponse.json(
        {
          error: "Failed to mint Azure Speech token.",
          details: detail || `HTTP ${response.status}`,
        },
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
    const message =
      error instanceof Error ? error.message : "Unexpected token error.";
    return NextResponse.json(
      { error: "Failed to mint Azure Speech token.", details: message },
      { status: 500 },
    );
  }
}
