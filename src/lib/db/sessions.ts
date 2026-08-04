import type { SupabaseClient } from "@supabase/supabase-js";
import type { PersonaConfig } from "@/lib/personaEngine";

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
  metrics: Record<string, unknown> | null;
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
  metrics?: Record<string, unknown> | null;
  averageScore?: number | null;
  durationMinutes?: number | null;
  endedAt?: string | null;
}

/**
 * `interview_sessions.metrics` is a single JSONB blob with three independent
 * owners: `launch` (setup config, written once at launch), `loop` (multi-round
 * progress, written by the server) and the live score metrics (written by the
 * client on every scored turn).
 *
 * Assigning the column wholesale meant a client PATCH carrying only score
 * fields silently deleted `launch` and `loop` — which broke round-type
 * selection in `/api/chat`, the `next-round` handoff, and cross-device resume.
 * We shallow-merge instead so each writer only touches its own keys.
 *
 * Shallow is the right depth here: every top-level key is replaced as a unit
 * (`launch` is always written whole, `dimensionSnapshots` is always the full
 * capped array), so a deep merge would only risk resurrecting stale nested
 * values.
 */
async function mergeMetrics(
  supabase: SupabaseClient,
  id: string,
  incoming: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("interview_sessions")
    .select("metrics")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;

  const existing = (data?.metrics ?? {}) as Record<string, unknown>;
  return { ...existing, ...incoming };
}

export async function updateSession(
  supabase: SupabaseClient,
  id: string,
  input: UpdateSessionInput,
): Promise<SessionRecord> {
  const patch: Record<string, unknown> = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.metrics !== undefined) {
    // `null` is an explicit reset; an object is merged over what is stored.
    patch.metrics =
      input.metrics === null
        ? null
        : await mergeMetrics(supabase, id, input.metrics);
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

/**
 * The strategy used on the previous scored turn.
 *
 * `decideInterviewAction` takes `previousStrategy` and escalates when the same
 * strategy would be chosen twice running — but nothing ever supplied it, so
 * that path was dead in production. One indexed lookup on the turn we are
 * about to score.
 */
export async function getPreviousStrategy(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("interview_turn_analyses")
    .select("strategy")
    .eq("session_id", sessionId)
    .order("turn_index", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.strategy ?? null;
}
