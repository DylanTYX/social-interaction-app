import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonaConfig } from "@/lib/persona-engine";
import type {
  LoopProgress,
  SessionLaunchMeta,
} from "@/lib/session-launch-meta";
import type { CompetencyCoverage } from "@/lib/competencies";

export type PracticeMode = "text" | "voice";
export type SessionStatus = "in_progress" | "completed" | "abandoned";
export type MessageRole = "user" | "assistant";

export interface SessionRecord {
  id: string;
  practiceMode: PracticeMode;
  scenarioValue: string;
  scenarioTitle: string | null;
  scenarioDescription: string | null;
  personaId: string | null;
  jobDescriptionId: string | null;
  resumeId: string | null;
  personaName: string;
  personaConfig: PersonaConfig;
  status: SessionStatus;
  summary: string | null;
  turnCount: number;
  averageScore: number | null;
  durationMinutes: number | null;
  /** Score metrics only — the server-owned parts are now their own columns. */
  metrics: Record<string, unknown> | null;
  launchMeta: SessionLaunchMeta | null;
  loopId: string | null;
  loopProgress: LoopProgress | null;
  competencyCoverage: CompetencyCoverage | null;
  startedAt: string;
  endedAt: string | null;
  createdAt: string;
}

export interface MessageRecord {
  id: string;
  role: MessageRole;
  content: string;
  turnIndex: number;
  createdAt: string;
}

interface SessionRow {
  id: string;
  practice_mode: PracticeMode;
  scenario_value: string;
  scenario_title: string | null;
  scenario_description: string | null;
  persona_id: string | null;
  job_description_id: string | null;
  resume_id: string | null;
  persona_name: string;
  persona_config: PersonaConfig;
  status: SessionStatus;
  summary: string | null;
  turn_count: number;
  average_score: number | null;
  duration_minutes: number | null;
  metrics: Record<string, unknown> | null;
  launch_meta: SessionLaunchMeta | null;
  loop_id: string | null;
  loop_progress: LoopProgress | null;
  competency_coverage: CompetencyCoverage | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

interface MessageRow {
  id: string;
  role: MessageRole;
  content: string;
  turn_index: number;
  created_at: string;
}

const SESSION_COLUMNS = `
  id,
  practice_mode,
  scenario_value,
  scenario_title,
  scenario_description,
  persona_id,
  job_description_id,
  resume_id,
  persona_name,
  persona_config,
  status,
  summary,
  turn_count,
  average_score,
  duration_minutes,
  metrics,
  launch_meta,
  loop_id,
  loop_progress,
  competency_coverage,
  started_at,
  ended_at,
  created_at
`;

function rowToSession(row: SessionRow): SessionRecord {
  return {
    id: row.id,
    practiceMode: row.practice_mode,
    scenarioValue: row.scenario_value,
    scenarioTitle: row.scenario_title,
    scenarioDescription: row.scenario_description,
    personaId: row.persona_id,
    jobDescriptionId: row.job_description_id,
    resumeId: row.resume_id,
    personaName: row.persona_name,
    personaConfig: row.persona_config,
    status: row.status,
    summary: row.summary,
    turnCount: row.turn_count,
    averageScore: row.average_score,
    durationMinutes: row.duration_minutes,
    metrics: row.metrics,
    launchMeta: row.launch_meta,
    loopId: row.loop_id,
    loopProgress: row.loop_progress,
    competencyCoverage: row.competency_coverage,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
  };
}

function rowToMessage(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    turnIndex: row.turn_index,
    createdAt: row.created_at,
  };
}

export async function listSessions(
  supabase: SupabaseClient,
  options: { limit?: number } = {},
): Promise<SessionRecord[]> {
  const { limit = 25 } = options;
  const { data, error } = await supabase
    .from("interview_sessions")
    .select(SESSION_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []).map((row) => rowToSession(row as SessionRow));
}

/**
 * Every session belonging to one interview loop, in the order it was run.
 *
 * Backed by `sessions_loop_idx`. Before migration 0009 the loop id lived inside
 * the `metrics` JSONB and could not be indexed, so the caller loaded 200 rows
 * and filtered them in memory.
 */
export async function listSessionsInLoop(
  supabase: SupabaseClient,
  loopId: string,
): Promise<SessionRecord[]> {
  const { data, error } = await supabase
    .from("interview_sessions")
    .select(SESSION_COLUMNS)
    .eq("loop_id", loopId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => rowToSession(row as SessionRow));
}

/**
 * Remove one session and everything hanging off it.
 *
 * The cascades already do the work and need no migration: `interview_messages`,
 * `interview_turn_analyses` and `coach_answers` are all `on delete cascade`,
 * and `llm_usage.session_id` is `on delete set null` — deliberately, because
 * the tokens were still spent and cost reporting must keep counting them.
 *
 * Ownership is left to the `sessions_owner_all` RLS policy, matching
 * `deletePersona` and friends. A foreign or missing id therefore deletes zero
 * rows and reports success rather than erroring, which is the existing contract
 * for every other delete in this codebase.
 *
 * The one thing no cascade can do is `loop_progress.completedSessionIds`. A
 * loop is N sessions sharing a `loop_id` with no parent row, and each later
 * round stores the ids of the rounds before it — a plain JSONB array with no
 * foreign key, so deleting round 2 leaves its uuid dangling inside rounds 3 and
 * 4. Nothing reads it back today, which makes it a latent bug rather than a
 * live one; it is pruned here so it stays that way.
 */
export async function deleteSession(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  // Read the loop id before the row is gone.
  const { data: target } = await supabase
    .from("interview_sessions")
    .select("id, loop_id")
    .eq("id", id)
    .maybeSingle();

  const { error } = await supabase
    .from("interview_sessions")
    .delete()
    .eq("id", id);
  if (error) throw error;

  const loopId = (target as { loop_id?: string | null } | null)?.loop_id;
  if (!loopId) return;

  await pruneLoopProgressReferences(supabase, loopId, id);
}

/**
 * Drop a deleted session's id from its siblings' `completedSessionIds`.
 *
 * Best-effort: a failure here leaves a stale uuid in a JSONB array nothing
 * currently reads, which is not worth failing the delete over. The session is
 * already gone by the time this runs.
 */
async function pruneLoopProgressReferences(
  supabase: SupabaseClient,
  loopId: string,
  deletedId: string,
): Promise<void> {
  try {
    const { data } = await supabase
      .from("interview_sessions")
      .select("id, loop_progress")
      .eq("loop_id", loopId);

    for (const row of (data ?? []) as Array<{
      id: string;
      loop_progress: { completedSessionIds?: string[] } | null;
    }>) {
      const completed = row.loop_progress?.completedSessionIds;
      if (!completed?.includes(deletedId)) continue;

      await supabase
        .from("interview_sessions")
        .update({
          loop_progress: {
            ...row.loop_progress,
            completedSessionIds: completed.filter((sid) => sid !== deletedId),
          },
        })
        .eq("id", row.id);
    }
  } catch (error) {
    console.warn("[deleteSession] could not prune loop progress:", error);
  }
}

export async function getSession(
  supabase: SupabaseClient,
  id: string,
): Promise<SessionRecord | null> {
  const { data, error } = await supabase
    .from("interview_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToSession(data as SessionRow) : null;
}

export interface CreateSessionInput {
  practiceMode: PracticeMode;
  scenarioValue: string;
  scenarioTitle?: string | null;
  scenarioDescription?: string | null;
  personaId?: string | null;
  jobDescriptionId?: string | null;
  resumeId?: string | null;
  personaName: string;
  personaConfig: PersonaConfig;
  metrics?: Record<string, unknown> | null;
  launchMeta?: SessionLaunchMeta | null;
  loopId?: string | null;
  loopProgress?: LoopProgress | null;
}

export async function createSession(
  supabase: SupabaseClient,
  userId: string,
  input: CreateSessionInput,
): Promise<SessionRecord> {
  const { data, error } = await supabase
    .from("interview_sessions")
    .insert({
      user_id: userId,
      practice_mode: input.practiceMode,
      scenario_value: input.scenarioValue,
      scenario_title: input.scenarioTitle ?? null,
      scenario_description: input.scenarioDescription ?? null,
      persona_id: input.personaId ?? null,
      job_description_id: input.jobDescriptionId ?? null,
      resume_id: input.resumeId ?? null,
      persona_name: input.personaName,
      persona_config: input.personaConfig,
      metrics: input.metrics ?? null,
      launch_meta: input.launchMeta ?? null,
      loop_id: input.loopId ?? null,
      loop_progress: input.loopProgress ?? null,
      status: "in_progress",
    })
    .select(SESSION_COLUMNS)
    .single();

  if (error) throw error;
  return rowToSession(data as SessionRow);
}

export interface UpdateSessionInput {
  status?: SessionStatus;
  summary?: string | null;
  /** Client-owned score metrics. Replaced wholesale — no merge needed now. */
  metrics?: Record<string, unknown> | null;
  averageScore?: number | null;
  durationMinutes?: number | null;
  endedAt?: string | null;
  launchMeta?: SessionLaunchMeta | null;
  loopId?: string | null;
  loopProgress?: LoopProgress | null;
  competencyCoverage?: CompetencyCoverage | null;
}

export async function updateSession(
  supabase: SupabaseClient,
  id: string,
  input: UpdateSessionInput,
): Promise<SessionRecord> {
  const patch: Record<string, unknown> = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.summary !== undefined) patch.summary = input.summary;
  // Straight assignment: the keys that used to collide with this write are
  // their own columns now, so there is nothing to merge and nothing to race.
  if (input.metrics !== undefined) patch.metrics = input.metrics;
  if (input.launchMeta !== undefined) patch.launch_meta = input.launchMeta;
  if (input.loopId !== undefined) patch.loop_id = input.loopId;
  if (input.loopProgress !== undefined)
    patch.loop_progress = input.loopProgress;
  if (input.competencyCoverage !== undefined) {
    patch.competency_coverage = input.competencyCoverage;
  }
  if (input.averageScore !== undefined)
    patch.average_score = input.averageScore;
  if (input.durationMinutes !== undefined)
    patch.duration_minutes = input.durationMinutes;
  if (input.endedAt !== undefined) patch.ended_at = input.endedAt;

  const { data, error } = await supabase
    .from("interview_sessions")
    .update(patch)
    .eq("id", id)
    .select(SESSION_COLUMNS)
    .single();

  if (error) throw error;
  return rowToSession(data as SessionRow);
}

export async function listMessages(
  supabase: SupabaseClient,
  sessionId: string,
  options: { limit?: number; ascending?: boolean } = {},
): Promise<MessageRecord[]> {
  const { limit, ascending = true } = options;
  let query = supabase
    .from("interview_messages")
    .select("id, role, content, turn_index, created_at")
    .eq("session_id", sessionId)
    .order("turn_index", { ascending });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((row) => rowToMessage(row as MessageRow));
}

/**
 * Append one interview turn and bump `turn_count`, atomically.
 *
 * This delegates to the `append_interview_turn` RPC (migration 0005) rather
 * than doing it client-side. The previous implementation derived `turn_index`
 * from a `turn_count` read at the top of the request, then inserted and bumped
 * in two separate statements — so two overlapping turns on one session wrote
 * duplicate indices, and a failure between the two statements left the counter
 * disagreeing with the rows. The RPC takes a row lock on the session, so
 * concurrent turns serialize and the index is always derived from committed
 * state.
 *
 * Pass `userMessage: null` for the opening turn, where the interviewer speaks
 * first and there is no paired user message.
 *
 * Returns the new turn_count.
 */
export interface TurnAnalysisInput {
  /** The full AnalysisResult, stored verbatim. */
  analysis: Record<string, unknown>;
  roundType?: string | null;
  overallScore?: number | null;
  strategy?: string | null;
  confidence?: number | null;
}

export async function appendTurn(
  supabase: SupabaseClient,
  sessionId: string,
  userMessage: string | null,
  assistantMessage: string,
  turnAnalysis?: TurnAnalysisInput | null,
): Promise<{ turnCount: number }> {
  const { data, error } = await supabase.rpc("append_interview_turn", {
    p_session_id: sessionId,
    p_user_content: userMessage,
    p_assistant_content: assistantMessage,
    // Optional: trivial answers and analyzer failures still persist the
    // messages, just without an analysis row.
    p_analysis: turnAnalysis?.analysis ?? null,
    p_round_type: turnAnalysis?.roundType ?? null,
    p_overall_score:
      typeof turnAnalysis?.overallScore === "number"
        ? Math.round(turnAnalysis.overallScore)
        : null,
    p_strategy: turnAnalysis?.strategy ?? null,
    p_confidence:
      typeof turnAnalysis?.confidence === "number"
        ? Math.round(turnAnalysis.confidence)
        : null,
  });

  if (error) throw error;

  const turnCount = typeof data === "number" ? data : Number(data);
  if (!Number.isFinite(turnCount)) {
    throw new Error("append_interview_turn returned an unexpected value.");
  }

  return { turnCount };
}

export interface TurnAnalysisRecord {
  id: string;
  turnIndex: number;
  roundType: string | null;
  overallScore: number | null;
  strategy: string | null;
  confidence: number | null;
  analysis: Record<string, unknown>;
  createdAt: string;
}

const TURN_ANALYSIS_COLUMNS =
  "id, turn_index, round_type, overall_score, strategy, confidence, analysis, created_at";

interface TurnAnalysisRow {
  id: string;
  turn_index: number;
  round_type: string | null;
  overall_score: number | null;
  strategy: string | null;
  confidence: number | null;
  analysis: Record<string, unknown>;
  created_at: string;
}

function rowToTurnAnalysis(row: TurnAnalysisRow): TurnAnalysisRecord {
  return {
    id: row.id,
    turnIndex: row.turn_index,
    roundType: row.round_type,
    overallScore: row.overall_score,
    strategy: row.strategy,
    confidence: row.confidence,
    analysis: row.analysis,
    createdAt: row.created_at,
  };
}

/** Every scored turn for a session, oldest first. Powers the report. */
export async function listTurnAnalyses(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<TurnAnalysisRecord[]> {
  const { data, error } = await supabase
    .from("interview_turn_analyses")
    .select(TURN_ANALYSIS_COLUMNS)
    .eq("session_id", sessionId)
    .order("turn_index", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => rowToTurnAnalysis(row as TurnAnalysisRow));
}

export interface PreviousTurnSignal {
  /**
   * `decideInterviewAction` escalates when the same strategy would be chosen
   * twice running — but nothing ever supplied it, so that path was dead.
   */
  strategy: string | null;
  /**
   * What the previous turn decided to probe next. Used as the job-description
   * retrieval query: this turn's question *is* that probe, so it retrieves what
   * is about to be asked about rather than what was just said.
   */
  nextFocus: string | null;
}

/**
 * The decision signal carried over from the previous scored turn. One indexed
 * lookup on the turn we are about to score.
 */
export async function getPreviousTurnSignal(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<PreviousTurnSignal> {
  const { data, error } = await supabase
    .from("interview_turn_analyses")
    .select("strategy, analysis")
    .eq("session_id", sessionId)
    .order("turn_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return { strategy: null, nextFocus: null };

  const topics = (data.analysis as { followupTopics?: unknown } | null)
    ?.followupTopics;
  const nextFocus =
    Array.isArray(topics) && typeof topics[0] === "string" && topics[0].trim()
      ? topics[0].trim()
      : null;

  return { strategy: data.strategy ?? null, nextFocus };
}
