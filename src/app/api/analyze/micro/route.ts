import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/supabase/server";
import { generateMicroFeedback } from "@/lib/micro-feedback";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user } = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured." },
        { status: 500 },
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
      return NextResponse.json(
        { error: "Response is too short for feedback." },
        { status: 400 },
      );
    }

    const feedback = await generateMicroFeedback(
      candidateResponse,
      question || "Tell me more about your experience.",
      apiKey,
    );

    return NextResponse.json(feedback);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Micro-feedback failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
