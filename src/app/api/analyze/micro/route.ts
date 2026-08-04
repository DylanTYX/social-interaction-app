import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { generateMicroFeedback } from "@/lib/micro-feedback";
import {
  badRequest,
  serverError,
  unauthorized,
} from "@/lib/api/errors";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/api/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user } = await getCurrentUser();
    if (!user) {
      return unauthorized();
    }

    const limited = enforceRateLimit(
      `micro:${user.id}`,
      RATE_LIMITS.microFeedback,
    );
    if (limited) return limited;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return serverError(
        "POST /api/analyze/micro",
        new Error("OPENAI_API_KEY is not configured."),
      );
    }

    const body = (await request.json()) as {
      candidateResponse?: string;
      question?: string;
    };

    const candidateResponse =
      typeof body.candidateResponse === "string"
        ? body.candidateResponse.trim()
        : "";
    const question =
      typeof body.question === "string" ? body.question.trim() : "";

    if (candidateResponse.length < 8) {
      return badRequest("Response is too short for feedback.");
    }

    const feedback = await generateMicroFeedback(
      candidateResponse,
      question || "Tell me more about your experience.",
      apiKey,
    );

    return NextResponse.json(feedback);
  } catch (error) {
    return serverError("POST /api/analyze/micro", error);
  }
}
