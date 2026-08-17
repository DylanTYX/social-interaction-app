import type { SupabaseClient } from "@supabase/supabase-js";
import type { SuggestedAnswerResult } from "@/lib/coach-contract";

/**
 * Cached coach suggested answers. See `supabase/migrations/0010_coach_answers.sql`.
 *
 * Follows the columns-constant / Row interface / `rowToX` mapper shape used by
 * the rest of `lib/db`, so the snake_case boundary stays in one place.
 */

/**
 * What lands in the `answer` JSONB column.
 *
 * An alias rather than its own shape: this cache stores the route's response
 * verbatim, so if the two ever diverge the cached rows become undecodable by
 * the client that reads them. Aliasing makes that divergence a type error.
 */
export type CoachAnswerPayload = SuggestedAnswerResult;

const COACH_ANSWER_COLUMNS = "id, turn_index, round_type, answer, created_at";

interface CoachAnswerRow {
  id: string;
  turn_index: number;
  round_type: string | null;
  /** Not `CoachAnswerPayload`: see `decodePayload`. */
  answer: CoachAnswerPayload & { modelAnswer?: string };
  created_at: string;
}

/**
 * Tolerate a row written before `suggestedAnswer` was called that.
 *
 * `0016_rename_model_answer_key.sql` rewrites the key in place, so this is
 * belt-and-braces for the window where code is deployed and the migration is
 * not — a gap in which every cached turn would otherwise render with the
 * suggested-answer panel silently missing, which reads as a broken feature
 * rather than a stale cache. Delete once 0016 has run everywhere.
 */
function decodePayload(row: CoachAnswerRow): CoachAnswerPayload {
  const { modelAnswer, ...payload } = row.answer;
  return payload.suggestedAnswer || !modelAnswer
    ? payload
    : { ...payload, suggestedAnswer: modelAnswer };
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
  return data ? decodePayload(data as CoachAnswerRow) : null;
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
