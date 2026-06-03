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

export async function updateSession(
  supabase: SupabaseClient,
  id: string,
  input: UpdateSessionInput,
): Promise<SessionRecord> {
  const patch: Record<string, unknown> = {};
  if (input.status !== undefined) patch.status = input.status;
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.metrics !== undefined) patch.metrics = input.metrics;
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
 * Append a user/assistant pair atomically and bump the session's turn_count.
 * Returns the new turn_count.
 */
export async function appendTurn(
  supabase: SupabaseClient,
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
  previousTurnCount: number,
): Promise<{ turnCount: number; userMessageId: string; assistantMessageId: string }> {
  const userTurn = previousTurnCount + 1;
  const assistantTurn = previousTurnCount + 2;

  const { data, error } = await supabase
    .from("interview_messages")
    .insert([
      {
        session_id: sessionId,
        role: "user",
        content: userMessage,
        turn_index: userTurn,
      },
      {
        session_id: sessionId,
        role: "assistant",
        content: assistantMessage,
        turn_index: assistantTurn,
      },
    ])
    .select("id, role");

  if (error) throw error;

  const inserted = (data ?? []) as Array<{ id: string; role: MessageRole }>;
  const userRow = inserted.find((row) => row.role === "user");
  const assistantRow = inserted.find((row) => row.role === "assistant");

  const { error: bumpError } = await supabase
    .from("interview_sessions")
    .update({ turn_count: assistantTurn })
    .eq("id", sessionId);

  if (bumpError) throw bumpError;

  return {
    turnCount: assistantTurn,
    userMessageId: userRow?.id ?? "",
    assistantMessageId: assistantRow?.id ?? "",
  };
}
