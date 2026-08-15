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
  /**
   * Answers that were actually scored, or `null` on queries that did not ask.
   * See `scoredTurnCountFrom` for why this is not the same as `turnCount`.
   */
  scoredTurnCount: number | null;
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
  /**
   * Present only on queries using `SESSION_LIST_COLUMNS`. PostgREST returns an
   * aggregate embed as a single-element array.
   */
  interview_turn_analyses?: Array<{ count: number }> | null;
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

/**
 * `SESSION_COLUMNS` plus how many turns of this session were actually scored.
 *
 * Deliberately not folded into `SESSION_COLUMNS`. That list is read on the chat
 * hot path, once per turn, and this adds an aggregate over a second table for
 * an answer only the history and stats views need.
 *
 * PostgREST resolves the embed through the `session_id` foreign key declared in
 * `0006_turn_analyses.sql`, and `turn_analyses_session_idx` covers it.
 */
const SESSION_LIST_COLUMNS = `${SESSION_COLUMNS},
  interview_turn_analyses(count)
`;

/**
 * Turns that produced a score, as opposed to messages exchanged.
 *
 * `turn_count` counts *messages* — the opening greeting plus two per exchange —
 * and it is deliberately kept that way, because `shouldRefreshSummary` and the
 * transcript window are both arithmetic over messages. But it means a session
 * padded with answers the analyzer skipped ("yes", "ok", the no-response
 * placeholder) reaches the `MIN_TURNS_TO_SCORE` threshold without ever having
 * been graded that many times. Counting the analyses is the honest measure of
 * "how many answers is this average actually over".
 */
function scoredTurnCountFrom(row: SessionRow): number | null {
  const embedded = row.interview_turn_analyses;
  if (!Array.isArray(embedded) || embedded.length === 0) return null;
  const count = embedded[0]?.count;
  return typeof count === "number" ? count : null;
}

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
    scoredTurnCount: scoredTurnCountFrom(row),
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

export interface ListSessionsOptions {
  limit?: number;
  offset?: number;
  /** Free text matched against the scenario title and the persona name. */
  query?: string;
  mode?: "text" | "voice";
  status?: SessionStatus;
}

export interface ListSessionsResult {
  sessions: SessionRecord[];
  /** Rows matching the filters, ignoring limit/offset. */
  total: number;
}

/**
 * A page of sessions, filtered in the database.
 *
 * Filtering used to happen client-side over whatever had been fetched, which
 * meant search reported "no matching sessions" whenever the match sat past the
 * fetch limit — it was answering "not in the first 50" while appearing to
 * answer "you don't have one". Paging without moving the filter down here would
 * have made that worse, not better.
 *
 * `count: "exact"` gives the caller the real total so it can say how much of it
 * is on screen. The same option is used by `countJobDescriptionChunks`.
 */
export async function listSessions(
  supabase: SupabaseClient,
  options: ListSessionsOptions = {},
): Promise<ListSessionsResult> {
  const { limit = 25, offset = 0, query, mode, status } = options;

  let request = supabase
    .from("interview_sessions")
    .select(SESSION_LIST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false });

  if (mode) request = request.eq("practice_mode", mode);
  if (status) request = request.eq("status", status);

  const trimmed = query?.trim();
  if (trimmed) {
    // Matches what the client-side filter matched: scenario title or persona.
    // `%` and `,` would otherwise break out of the `or` filter's own syntax.
    const safe = trimmed.replace(/[%,()]/g, " ");
    request = request.or(
      `scenario_title.ilike.%${safe}%,persona_name.ilike.%${safe}%`,
    );
  }

  const { data, error, count } = await request.range(
    offset,
    offset + limit - 1,
  );

  if (error) throw error;
  return {
    sessions: (data ?? []).map((row) => rowToSession(row as SessionRow)),
    total: count ?? 0,
  };
}

/**
 * How many of the user's sessions are attached to one job description.
 *
 * Exists to answer a question the delete dialog could not: deleting a JD nulls
 * `job_description_id` on every session using it and cascades the JD's chunks,
 * so an interview still in progress loses its grounding the moment it resumes.
 * The dialog said "Existing transcripts are unaffected", which is true of the
 * message rows and reads as though nothing in flight is harmed.
 *
 * A count query rather than `listSessions` with a new filter: that path selects
 * 23 columns plus an aggregate join over `interview_turn_analyses` to build a
 * page of cards, and this needs one integer. Same shape as
 * `countJobDescriptionChunks`, and `sessions_job_description_idx` (migration
 * 0002) already covers the predicate.
 *
 * RLS scopes it to the caller, so there is no `user_id` filter here.
 */
export async function countSessionsForJobDescription(
  supabase: SupabaseClient,
  jobDescriptionId: string,
  options: { status?: SessionStatus } = {},
): Promise<number> {
  let request = supabase
    .from("interview_sessions")
    .select("id", { count: "exact", head: true })
    .eq("job_description_id", jobDescriptionId);

  if (options.status) request = request.eq("status", options.status);

  const { count, error } = await request;
  if (error) throw error;
  return count ?? 0;
}

/**
 * Every session belonging to one interview loop, in the order it was run.
 *
 * Backed by `sessions_loop_idx`. Before migration 0009 the loop id lived inside
 * the `metrics` JSONB and could not be indexed, so the caller loaded 200 rows
 * and filtered them in memory.
 */
/**
 * Every session in one interview loop.
 *
 * Bounded by `MAX_LOOP_ROUNDS`, because `/api/loops/[loopId]` runs a
 * `listTurnAnalyses` per row returned. `loop_id` is not settable through the
 * API — but it is a plain column, so a direct table write could point every
 * session a user owns at one loop and turn a single GET into a fan-out over all
 * of them. A loop cannot legitimately exceed its configured round count.
 */
/** A loop cannot have more rounds than the setup wizard allows. */
const MAX_LOOP_ROUNDS = 10;
/** Far past the longest configured round; a session cannot legitimately exceed it. */
const MAX_TURN_ANALYSES = 200;

export async function listSessionsInLoop(
  supabase: SupabaseClient,
  loopId: string,
): Promise<SessionRecord[]> {
  const { data, error } = await supabase
    .from("interview_sessions")
    .select(SESSION_COLUMNS)
    .eq("loop_id", loopId)
    .order("created_at", { ascending: true })
    .limit(MAX_LOOP_ROUNDS);

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

  /**
   * Through an RPC, not a direct update.
   *
   * `authenticated` no longer holds `update` on this table: it grants the
   * browser the same privilege it grants these routes, so every validation
   * here was advisory against a direct PostgREST call. `update_session_progress`
   * is `security definer` and re-checks `user_id = auth.uid()` itself, which is
   * what RLS used to do.
   *
   * The patch keeps its "key present" semantics — a missing key leaves the
   * column alone, an explicit null clears it — so `ended_at: null` still means
   * something different from not mentioning `ended_at`.
   */
  const { error: rpcError } = await supabase.rpc("update_session_progress", {
    p_session_id: id,
    p_patch: patch,
  });
  if (rpcError) throw rpcError;

  // Read back separately: the function returns void, and the caller wants the
  // row as it now stands.
  const { data, error } = await supabase
    .from("interview_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", id)
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

  // A limit means "the most recent N", never "the first N".
  //
  // This combined `ascending: true` with `.limit()`, which returns the OLDEST
  // rows — so every caller that passed a limit was reading from the wrong end.
  // `/resume` (200), `/report` (400) and `/export` (500) all silently truncated
  // the *recent* half of a long session.
  //
  // The sharpest consequence was in `recoverPersistedTurn`, which inspects the
  // last two messages to decide whether a turn landed before a stream failed.
  // Past the cap it compared messages 199 and 200, concluded the turn was never
  // written, and let the client re-POST it — duplicating the answer and
  // re-running every model call, which is the exact double-charge that module
  // exists to prevent.
  //
  // `chat/route.ts` already worked around this by hand (order descending, take
  // the limit, reverse). That workaround now lives here, once.
  if (limit) {
    const { data, error } = await supabase
      .from("interview_messages")
      .select("id, role, content, turn_index, created_at")
      .eq("session_id", sessionId)
      .order("turn_index", { ascending: false })
      .limit(limit);

    if (error) throw error;
    const tail = (data ?? []).map((row) => rowToMessage(row as MessageRow));
    // The query had to run descending to take the tail; hand it back in the
    // order the caller asked for.
    return ascending ? tail.reverse() : tail;
  }

  const { data, error } = await supabase
    .from("interview_messages")
    .select("id, role, content, turn_index, created_at")
    .eq("session_id", sessionId)
    .order("turn_index", { ascending });

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
/**
 * Scored turns for one session, oldest first.
 *
 * Capped well above any real round — `targetTurnsForDuration` tops out in the
 * low dozens — because `/report`, `/resume` and `/next-round` all call this and
 * none of them was rate limited.
 */
export async function listTurnAnalyses(
  supabase: SupabaseClient,
  sessionId: string,
): Promise<TurnAnalysisRecord[]> {
  const { data, error } = await supabase
    .from("interview_turn_analyses")
    .select(TURN_ANALYSIS_COLUMNS)
    .eq("session_id", sessionId)
    .order("turn_index", { ascending: true })
    .limit(MAX_TURN_ANALYSES);

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
