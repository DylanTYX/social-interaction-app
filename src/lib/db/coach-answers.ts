import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cached coach model answers. See `supabase/migrations/0010_coach_answers.sql`.
 *
 * Follows the columns-constant / Row interface / `rowToX` mapper shape used by
 * the rest of `lib/db`, so the snake_case boundary stays in one place.
 */

export interface CoachAnswerPayload {
  modelAnswer: string;
  rewrite: string;
  tips: string[];
}

const COACH_ANSWER_COLUMNS = "id, turn_index, round_type, answer, created_at";

interface CoachAnswerRow {
  id: string;
  turn_index: number;
  round_type: string | null;
  answer: CoachAnswerPayload;
  created_at: string;
}

/**
 * The cached answer for one turn, or null.
 *
 * RLS scopes this to sessions the caller owns, so a wrong `sessionId` returns
 * nothing rather than another user's coaching.
 */
export async function getCoachAnswer(
  supabase: SupabaseClient,
  sessionId: string,
  turnIndex: number,
): Promise<CoachAnswerPayload | null> {
  const { data, error } = await supabase
    .from("coach_answers")
    .select(COACH_ANSWER_COLUMNS)
    .eq("session_id", sessionId)
    .eq("turn_index", turnIndex)
    .maybeSingle();

  if (error) throw error;
  return data ? (data as CoachAnswerRow).answer : null;
}

/**
 * Store a generated answer, best-effort.
 *
 * Deliberately never throws. The user already has their coaching by the time
 * this runs — failing the response because the *cache* write failed would turn
 * a saved-money optimisation into a new way for the feature to break. A
 * conflict is equally fine: two tabs expanding the same turn race, the unique
 * constraint settles it, and both see the same content.
 */
export async function saveCoachAnswer(
  supabase: SupabaseClient,
  input: {
    sessionId: string;
    turnIndex: number;
    roundType: string | null;
    answer: CoachAnswerPayload;
  },
): Promise<void> {
  try {
    const { error } = await supabase.from("coach_answers").upsert(
      {
        session_id: input.sessionId,
        turn_index: input.turnIndex,
        round_type: input.roundType,
        answer: input.answer,
      },
      { onConflict: "session_id,turn_index", ignoreDuplicates: true },
    );
    if (error) {
      console.warn("[coach-answers] cache write failed:", error.message);
    }
  } catch (error) {
    console.warn("[coach-answers] cache write threw:", error);
  }
}
