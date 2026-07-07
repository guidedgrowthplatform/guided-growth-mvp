import { waitUntil } from '@vercel/functions';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser, setUserContext, handlePreflight } from '../_lib/auth.js';
import { checkRateLimit } from '../_lib/rate-limit.js';
import { getClientIp, UUID_REGEX, validateTimezone } from '../_lib/validation.js';
import { scrubPII } from '../_lib/pii-scrubber.js';
import {
  TOOL_DEFINITIONS,
  dispatchToolCall,
  type ToolName,
  type ToolResult,
} from '../_lib/llm/tools.js';
import {
  joinBrainDumpChunks,
  mergeBrainDumpChunks,
} from '../_lib/llm/onboarding/brainDumpTurnMerge.js';
import { SameTurnToolDedupe } from '../_lib/llm/onboarding/sameTurnToolDedupe.js';
import { dispatchOnboardingToolCall } from '../_lib/llm/onboarding/dispatch.js';
import { getOnboardingTools } from '../_lib/llm/onboarding/registry.js';
import { isOnboardingToolName } from '../_lib/llm/onboarding/schemas.js';
import { dispatchCheckinToolCall } from '../_lib/llm/checkin/dispatch.js';
import {
  getCheckinTools,
  getReadOnlyCheckinTools,
  getCheckinOpenerTools,
} from '../_lib/llm/checkin/registry.js';
import { isCheckinToolName } from '../_lib/llm/checkin/schemas.js';
import { handleCheckinTool } from '../_lib/llm/checkin/handleCheckinToolRoute.js';
import { getOpenAIKey, OpenAIError } from '../_lib/llm/openai.js';
import { openResponsesStream, type ResponseInputItem } from '../_lib/llm/openai-responses.js';
import { handleParseBrainDump } from '../_lib/llm/parseBrainDump.js';
import { buildSystemPromptForRequest } from '../_lib/llm/buildSystemPrompt.js';
import { MUTATING_TOOLS } from '@gg/shared/checkin/mutatingTools';
import { reportToolFailure, reportRequestFailure, flushSentry } from '../_lib/sentry.js';
import type { SessionStateDeltaEntry } from '@gg/shared/types/context';

type CoachingStyle = 'warm' | 'direct' | 'reflective';
const COACHING_STYLES = new Set<CoachingStyle>(['warm', 'direct', 'reflective']);
const TOOL_NAMES = new Set<string>(TOOL_DEFINITIONS.map((t) => t.name));
// The screen context_block is already injected into the system prompt by
// buildSystemPromptForRequest, so offering get_user_context here just lets the
// model burn a paid round-trip (and one of MAX_ROUNDS) re-fetching what it
// already has. Keep it in TOOL_DEFINITIONS for the Vapi wire artifact, but drop
// it from the Direct-LLM base set. Still dispatchable if ever called.
const DIRECT_LLM_BASE_TOOLS = TOOL_DEFINITIONS.filter((t) => t.name !== 'get_user_context');

type LLMStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; id: string; ok: boolean; result: unknown }
  | { type: 'tool_failed'; id: string; name: string; error: string; message?: string }
  | {
      type: 'done';
      latency_ms: number;
      total_tokens: number;
      tool_rounds: number;
      ttft_ms?: number;
    }
  // `debug` is only populated when the request carries `x-gg-debug: 1` — it
  // names the failing stage + error class for QA without leaking internals
  // (or stack traces) to normal clients.
  | { type: 'error'; code: string; message: string; debug?: { stage: string; class?: string } };

const MAX_ROUNDS = 5;
// W_SILENT-FIX (Mint 2026-07-07 "coach goes silent" report; root-caused in
// gg-spec/docs/video-feedback-runs/Mint-test-and-bug-report-2026-07-07-at-13.17.16/conductor-review.md):
// a model that keeps re-emitting a tool call the gate or a handler guard
// rejects (unknown_tool on the wrong beat, checkin_not_grounded, invalid_args,
// max_habits_reached, ...) used to burn the whole round budget in silence —
// same-turn dedupe (SameTurnToolDedupe) only catches an EXACT (name, args)
// repeat, so varied args slip straight through. Two levers below stop the
// storm and guarantee the turn always ends with real coach text:
//  - Lever 1: once a specific tool has failed this many times in ONE turn,
//    stop offering it for the rest of the turn (killed at the source).
//  - Lever 2 (below, in the round loop): the last allowed round is always
//    forced text-only (tool_choice: 'none'), so even a turn that never trips
//    the per-tool ban still ends with words instead of one more doomed call.
const TOOL_FAILURE_BAN_LIMIT = 2;
// Last-resort line if a capped turn still produced literally no text (the
// model only ever emitted tool calls, never a token of prose). Mirrors the
// voice already authored for the model itself — see the example line in
// noInternalNarrationRule.ts.
const TOOL_CAP_FALLBACK_TEXT = "I couldn't quite get that saved just now. Mind trying again?";
const ONBOARDING_MODEL = process.env.ONBOARDING_LLM_MODEL || 'gpt-4o';
const FORK_SCREEN_ID = 'ONBOARD-FORK--FORM';
// Onboarding turns emit tool JSON (add_habit / update_habit / advance_step,
// sometimes several per turn on the habit beats) ON TOP of the coach's text.
// The shared 600-token default truncated exactly there (response.incomplete →
// the B11 empty-turn wedge), so onboarding gets more output headroom.
const ONBOARDING_MAX_OUTPUT_TOKENS = 1000;

interface PersistedToolRow {
  toolCallId: string;
  toolName: string;
  resultJson: string;
}

function isExpiredPreviousResponse(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const status = (err as { status?: number }).status;
  const code = (err as { code?: string }).code;
  const message = (err as { message?: string }).message ?? '';
  if (status === 404 || code === 'response_not_found') return true;
  if (/previous_response_id/i.test(message) && /not.*found|expired/i.test(message)) return true;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;

  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : segments[0] || '';

  // Warmup fast path: fired by the client at app-open to pre-warm this function
  // + the pg pool before the user's first real LLM call. No auth, no rate
  // limit, no OpenAI touch — just boots the function and pings the DB pool.
  // Kept ahead of ALL other checks (including the route-404 gate) so it never
  // risks getting entangled with auth/rate-limit/parsing changes below.
  if (route === 'warmup' && req.method === 'GET') {
    const dbStart = performance.now();
    let db_ms: number;
    try {
      await pool.query('SELECT 1');
      db_ms = Math.round(performance.now() - dbStart);
    } catch {
      // A failing warmup must never alarm the client — the function boot
      // itself already happened, which is most of the value.
      db_ms = -1;
    }
    return res.status(200).json({ warm: true, db_ms });
  }

  if (route !== '' && route !== 'parse-brain-dump' && route !== 'checkin-tool') {
    return res.status(404).json({ error: 'Not found' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // QA visibility flag: `x-gg-debug: 1` echoes the failing stage + error class
  // in error payloads. Failure logging below is unconditional (Vercel function
  // logs had NOTHING for most B11 failure classes — Sentry DSN is not set on
  // the API functions, session_log is best-effort and invisible to QA).
  const debugRequested = req.headers['x-gg-debug'] === '1';

  try {
    getOpenAIKey();
  } catch (err) {
    console.error('[llm:fail]', JSON.stringify({ stage: 'config', code: 'missing_openai_key' }));
    return res.status(500).json({ error: (err as Error).message });
  }

  const ip = getClientIp(req.headers);
  const ipRl = checkRateLimit(ip, {
    windowMs: 60_000,
    maxRequests: 30,
    keyPrefix: 'llm-ip',
  });
  if (ipRl.limited) {
    return res.status(429).json({ error: 'Too many requests', retryAfter: ipRl.retryAfter });
  }

  const user = await requireUser(req, res);
  if (!user) return;
  await setUserContext(user.anonId);

  const userRl = checkRateLimit(user.authUserId, {
    windowMs: 60_000,
    maxRequests: 20,
    keyPrefix: 'llm-user',
  });
  const userDailyRl = checkRateLimit(user.authUserId, {
    windowMs: 86_400_000,
    maxRequests: 200,
    keyPrefix: 'llm-user-daily',
  });
  if (userRl.limited || userDailyRl.limited) {
    const retryAfter = userRl.retryAfter || userDailyRl.retryAfter;
    return res.status(429).json({ error: 'Too many requests', retryAfter });
  }

  if (route === 'parse-brain-dump') {
    return handleParseBrainDump(req, res, { anonId: user.anonId });
  }

  if (route === 'checkin-tool') {
    return handleCheckinTool(req, res, { anonId: user.anonId });
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const sessionId = body.session_id;
  if (typeof sessionId !== 'string' || sessionId.trim().length < 8) {
    return res.status(400).json({ error: 'session_id must be a string of at least 8 chars' });
  }
  const screenId = body.screen_id;
  if (typeof screenId !== 'string' || screenId.length === 0 || screenId.length > 200) {
    return res.status(400).json({ error: 'screen_id is required (1-200 chars)' });
  }
  const mode: 'chat' | 'opener' = body.mode === 'opener' ? 'opener' : 'chat';
  const userMessageRaw = body.user_message;
  if (mode === 'chat') {
    if (
      typeof userMessageRaw !== 'string' ||
      userMessageRaw.length === 0 ||
      userMessageRaw.length > 2000
    ) {
      return res.status(400).json({ error: 'user_message is required (1-2000 chars)' });
    }
  } else if (userMessageRaw !== undefined && typeof userMessageRaw !== 'string') {
    return res.status(400).json({ error: 'user_message must be a string when provided' });
  }
  const userMessage: string =
    mode === 'opener' ? '[user just opened the chat — no message yet]' : (userMessageRaw as string);

  let coachingStyle: CoachingStyle = 'warm';
  if (body.coaching_style !== undefined) {
    if (
      typeof body.coaching_style !== 'string' ||
      !COACHING_STYLES.has(body.coaching_style as CoachingStyle)
    ) {
      return res.status(400).json({ error: 'invalid coaching_style' });
    }
    coachingStyle = body.coaching_style as CoachingStyle;
  }

  let recentEvents: SessionStateDeltaEntry[] | undefined;
  if (body.recent_events !== undefined) {
    if (!Array.isArray(body.recent_events)) {
      return res.status(400).json({ error: 'recent_events must be an array' });
    }
    recentEvents = body.recent_events as SessionStateDeltaEntry[];
  }

  // Un-defaulted for the prompt's time block — omit it rather than assert a
  // confidently-wrong UTC time when the client sent no tz (MR#3). The UTC
  // fallback below is fine for tool/habit local-day computation.
  const rawTimezone = validateTimezone(body.timezone);
  const timezone = rawTimezone ?? 'UTC';

  // Default 'text' when absent/invalid — text phrasing reads fine aloud, but
  // voice phrasing ("tap the orb") misleads a typer (GitLab #217).
  const inputMode: 'voice' | 'text' = body.input_mode === 'voice' ? 'voice' : 'text';

  const priorOpener =
    typeof body.prior_opener === 'string' && body.prior_opener.length <= 2000
      ? body.prior_opener
      : undefined;

  let chatSessionId: string | null = null;
  let userTurnId: string | null = null;
  if (body.chat_session_id !== undefined) {
    if (typeof body.chat_session_id !== 'string' || !UUID_REGEX.test(body.chat_session_id)) {
      return res.status(400).json({ error: 'chat_session_id must be a UUID' });
    }
    chatSessionId = body.chat_session_id;
    if (mode === 'chat') {
      if (typeof body.user_turn_id !== 'string' || !UUID_REGEX.test(body.user_turn_id)) {
        return res.status(400).json({ error: 'user_turn_id is required (UUID) when mode=chat' });
      }
      userTurnId = body.user_turn_id;
    }
  }
  const persistChat = chatSessionId !== null;

  // Stable, grep-able failure line for EVERY hard failure on this route.
  // One prefix ([llm:fail]) so Vercel function logs answer "what failed and
  // where" without dashboard spelunking. Never throws.
  const logFailure = (stage: string, code: string, err?: unknown, extra?: object) => {
    try {
      const e = err as { name?: string; message?: string; status?: number } | undefined;
      console.error(
        '[llm:fail]',
        JSON.stringify({
          stage,
          code,
          screen_id: screenId,
          mode,
          error_class: e?.name,
          status: e?.status,
          message: typeof e?.message === 'string' ? e.message.slice(0, 300) : undefined,
          ...extra,
        }),
      );
    } catch {
      // logging must never break the request
    }
  };
  const debugInfo = (stage: string, err?: unknown) =>
    debugRequested ? { debug: { stage, class: (err as { name?: string } | undefined)?.name } } : {};

  const isOnboardingScreen = screenId.startsWith('ONBOARD-');
  const requestModel: string | undefined = isOnboardingScreen ? ONBOARDING_MODEL : undefined;
  // Onboarding captures real name/age/brain-dump — scrubbing would destroy the
  // signal. Stored raw in chat_messages (see CLAUDE.md gotcha #8).
  const scrubbedMessage = isOnboardingScreen ? userMessage : scrubPII(userMessage);

  const isForkScreen = screenId === FORK_SCREEN_ID;

  // W2-E: confirm-turn grounding window. habit_name_ungrounded (addHabit.ts)
  // compared only the CURRENT turn's user_text, which trips on a two-turn
  // confirm shape ("I want to stop doomscrolling at night" / next turn:
  // "yes please add it") — the name grounds in the EARLIER turn, not the one
  // that actually triggers the tool call. Load the last few real user turns
  // (this table already has them; role='user' rows are the user's own typed
  // or Vapi-relayed text) so the guard can check the whole window, not just
  // the latest message. Onboarding-only and persistChat-only — the same
  // scope the guard itself already applies in (isOnboardingScreen dispatch).
  const USER_TEXT_WINDOW_SIZE = 3;
  // W2-H: assistant (coach) window, same scope, much shorter — only used to
  // resolve a bare "yes" affirming a coach-named preset (see addHabit.ts).
  // 2 turns is enough to cover the proposal turn even if the coach split its
  // reply across an extra short turn; wider would risk grounding against a
  // stale proposal from earlier in the conversation.
  const ASSISTANT_TEXT_WINDOW_SIZE = 2;
  let systemPrompt: string;
  let previousResponseId: string | null = null;
  let foreignOwned: boolean;
  let pathAlreadySet = false;
  let userTextWindow: string[] | undefined;
  let assistantTextWindow: string[] | undefined;
  try {
    const [built, ownerRow, forkPathRow, recentUserTurns, recentAssistantTurns] = await Promise.all(
      [
        buildSystemPromptForRequest({
          anon_id: user.anonId,
          screen_id: screenId,
          coaching_style: coachingStyle,
          recent_events: recentEvents,
          mode,
          timezone: rawTimezone,
          input_mode: inputMode,
        }),
        persistChat
          ? pool
              .query<{ foreign_owned: boolean; prev_response_id: string | null }>(
                `SELECT
                 EXISTS (
                   SELECT 1 FROM chat_messages
                    WHERE chat_session_id = $2 AND anon_id <> $1
                 ) AS foreign_owned,
                 (SELECT openai_response_id FROM chat_messages
                    WHERE anon_id = $1 AND chat_session_id = $2 AND role = 'assistant'
                      AND openai_response_id IS NOT NULL
                    ORDER BY turn_index DESC LIMIT 1) AS prev_response_id`,
                [user.anonId, chatSessionId],
              )
              .then((r) => r.rows[0] ?? null)
          : Promise.resolve(null),
        isForkScreen
          ? pool
              .query<{
                path: string | null;
              }>(`SELECT path FROM onboarding_states WHERE anon_id = $1`, [user.anonId])
              .then((r) => r.rows[0] ?? null)
          : Promise.resolve(null),
        isOnboardingScreen && persistChat && mode === 'chat'
          ? pool
              .query<{ content: string | null }>(
                `SELECT content FROM chat_messages
                WHERE anon_id = $1 AND chat_session_id = $2 AND role = 'user'
                  AND content IS NOT NULL AND length(trim(content)) > 0
                ORDER BY turn_index DESC
                LIMIT $3`,
                [user.anonId, chatSessionId, USER_TEXT_WINDOW_SIZE],
              )
              .then((r) => r.rows.map((row) => row.content as string))
          : Promise.resolve<string[]>([]),
        isOnboardingScreen && persistChat && mode === 'chat'
          ? pool
              .query<{ content: string | null }>(
                `SELECT content FROM chat_messages
                WHERE anon_id = $1 AND chat_session_id = $2 AND role = 'assistant'
                  AND content IS NOT NULL AND length(trim(content)) > 0
                ORDER BY turn_index DESC
                LIMIT $3`,
                [user.anonId, chatSessionId, ASSISTANT_TEXT_WINDOW_SIZE],
              )
              .then((r) => r.rows.map((row) => row.content as string))
          : Promise.resolve<string[]>([]),
      ],
    );
    systemPrompt = built.systemPrompt;
    // Newest-first from the query (DESC); the CURRENT turn's own message
    // (scrubbedMessage/userMessage) isn't in chat_messages yet at this point
    // in the request, so this is purely PRIOR turns, oldest excluded beyond N.
    userTextWindow = recentUserTurns.length > 0 ? recentUserTurns : undefined;
    // Same newest-first, prior-turns-only shape as userTextWindow above, just
    // for the coach's own text (W2-H). Never mixed into userTextWindow — see
    // shared.ts's OnboardingHandlerCtx doc for why the two stay separate.
    assistantTextWindow = recentAssistantTurns.length > 0 ? recentAssistantTurns : undefined;
    // A dedicated check-in opener LEADS a fresh structured flow (evening:
    // habits → reflection → wrap-up). Chaining onto prior chatter in the same
    // session anchors the model to whatever it said before (e.g. a stale "let's
    // reflect" opener), overriding the lead-with-habits instruction. Start it
    // from a clean response chain; the next (chat) turn chains on this opener.
    const isDedicatedCheckinOpener =
      mode === 'opener' && (screenId === 'MCHECK-01' || screenId === 'ECHECK-01');
    previousResponseId = isDedicatedCheckinOpener ? null : (ownerRow?.prev_response_id ?? null);
    foreignOwned = ownerRow?.foreign_owned ?? false;
    pathAlreadySet = typeof forkPathRow?.path === 'string' && forkPathRow.path.length > 0;
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        '[/api/llm] prompt assembled',
        JSON.stringify({
          screen_id: screenId,
          coaching_style: coachingStyle,
          context_version: built.contextVersion,
          delta_count: built.deltaCount,
          system_prompt_chars: systemPrompt.length,
          previous_response_id: previousResponseId,
          mode,
        }),
      );
    }
  } catch (err) {
    logFailure('build_prompt', 'build_system_prompt_failed', err);
    return res.status(500).json({
      error: 'build_system_prompt_failed',
      message: (err as Error).message,
      ...debugInfo('build_prompt', err),
    });
  }

  // Blocks reuse of another anon's session id before streaming.
  if (foreignOwned) {
    return res.status(403).json({ error: 'chat_session_forbidden' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const abortController = new AbortController();
  let clientClosed = false;
  req.on('close', () => {
    clientClosed = true;
    abortController.abort();
  });

  const send = (event: LLMStreamEvent) => {
    if (clientClosed) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  const startedAt = performance.now();
  // Latency lane T1: request start -> first streamed delta (server-leg TTFT).
  // Set once across tool rounds; shipped on the done event + session_log end row.
  let firstDeltaAtMs: number | null = null;
  let totalTokens = 0;
  let toolRounds = 0;
  type EndStatus = 'ok' | 'error' | 'tool_cap' | 'cancelled';
  let endStatus: EndStatus = 'error';
  let endCode: string | null = null;
  let finalAssistantContent = '';
  let finalAssistantToolCalls: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }> | null = null;
  let finalResponseId: string | null = null;
  const persistedToolRows: PersistedToolRow[] = [];

  const writeStartRow = async () => {
    try {
      await pool.query(
        `INSERT INTO session_log (anon_id, session_id, event_type, screen_id, payload)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          user.anonId,
          sessionId,
          'llm_call',
          screenId,
          {
            phase: 'start',
            screen_id: screenId,
            coaching_style: coachingStyle,
            model: requestModel ?? 'gpt-4o-mini',
            mode,
            had_previous_response_id: previousResponseId !== null,
          },
        ],
      );
    } catch {
      // best-effort
    }
  };

  const writeEndRow = async () => {
    try {
      await pool.query(
        `INSERT INTO session_log (anon_id, session_id, event_type, screen_id, payload)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          user.anonId,
          sessionId,
          'llm_call',
          screenId,
          {
            phase: 'end',
            screen_id: screenId,
            status: endStatus,
            error_code: endCode,
            latency_ms: Math.round(performance.now() - startedAt),
            ttft_ms: firstDeltaAtMs === null ? null : Math.round(firstDeltaAtMs),
            total_tokens: totalTokens,
            tool_rounds: toolRounds,
            mode,
          },
        ],
      );
    } catch {
      // best-effort
    }
  };

  // Single-shot end-row write, called before every res.end() (not after).
  let finalized = false;
  const finalize = async () => {
    if (finalized) return;
    finalized = true;
    await writeEndRow();
    // Single chokepoint for hard request-level failures (cancelled excluded).
    if (endStatus === 'error') {
      reportRequestFailure('llm', endCode ?? 'internal_error', user.anonId);
    }
    // Deferred — don't block the (error) response on the Sentry flush.
    waitUntil(flushSentry());
  };

  // Server-owned turn_index. Dedicated client + advisory xact-lock so base=MAX+1
  // and the turn lands contiguously (pool is max:1; pool.query can't span a txn).
  const persistChatTurn = async (opts: { includeAssistant?: boolean } = {}) => {
    const includeAssistant = opts.includeAssistant ?? true;
    if (!persistChat) return;
    if (!includeAssistant && persistedToolRows.length === 0) return; // nothing to write
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [chatSessionId]);
      if (includeAssistant && mode === 'chat' && userTurnId) {
        const dup = await client.query('SELECT 1 FROM chat_messages WHERE id = $1', [userTurnId]);
        if (dup.rowCount) {
          await client.query('COMMIT');
          return;
        }
      }
      const baseRes = await client.query<{ base: number }>(
        'SELECT COALESCE(MAX(turn_index) + 1, 0) AS base FROM chat_messages WHERE chat_session_id = $1',
        [chatSessionId],
      );
      const base = baseRes.rows[0].base;
      const assistantIndex = mode === 'opener' ? base : base + 1;

      if (includeAssistant && mode === 'chat' && userTurnId) {
        await client.query(
          `INSERT INTO chat_messages
             (id, anon_id, chat_session_id, screen_id, turn_index, role, content, mode)
           VALUES ($1, $2, $3, $4, $5, 'user', $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [userTurnId, user.anonId, chatSessionId, screenId, base, scrubbedMessage, mode],
        );
      }

      if (includeAssistant) {
        await client.query(
          `INSERT INTO chat_messages
             (anon_id, chat_session_id, screen_id, turn_index, role, content, tool_calls, openai_response_id, mode)
           VALUES ($1, $2, $3, $4, 'assistant', $5, $6, $7, $8)
           ON CONFLICT (chat_session_id, turn_index) DO NOTHING`,
          [
            user.anonId,
            chatSessionId,
            screenId,
            assistantIndex,
            finalAssistantContent.length > 0 ? finalAssistantContent : null,
            finalAssistantToolCalls ? JSON.stringify(finalAssistantToolCalls) : null,
            finalResponseId,
            mode,
          ],
        );
      }

      // Error-path persist: skip assistant row, still write tool rows for dedup.
      // Bare ON CONFLICT covers both (chat_session_id, turn_index) and the
      // (user_turn_id, tool_call_id) dedup unique — either match suppresses.
      const toolStartIndex = includeAssistant ? assistantIndex + 1 : base;
      for (let i = 0; i < persistedToolRows.length; i++) {
        const tr = persistedToolRows[i];
        await client.query(
          `INSERT INTO chat_messages
             (anon_id, chat_session_id, screen_id, turn_index, role, content, tool_call_id, tool_name, mode, user_turn_id)
           VALUES ($1, $2, $3, $4, 'tool', $5, $6, $7, $8, $9)
           ON CONFLICT DO NOTHING`,
          [
            user.anonId,
            chatSessionId,
            screenId,
            toolStartIndex + i,
            tr.resultJson,
            tr.toolCallId,
            tr.toolName,
            mode,
            userTurnId,
          ],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // rollback best-effort
      }
      console.error('[/api/llm] persist chat turn failed', err);
    } finally {
      client.release();
    }
  };

  // Reuse persisted tool row from a prior crash mid-turn; same (user_turn_id, tool_call_id).
  const dedupLookup = async (toolCallId: string): Promise<ToolResult | null> => {
    if (!persistChat || !userTurnId) return null;
    const r = await pool.query<{ content: string | null }>(
      `SELECT content FROM chat_messages
        WHERE user_turn_id = $1 AND tool_call_id = $2 AND role = 'tool'
        LIMIT 1`,
      [userTurnId, toolCallId],
    );
    if (!r.rowCount || !r.rows[0] || !r.rows[0].content) return null;
    try {
      return JSON.parse(r.rows[0].content) as ToolResult;
    } catch {
      return null;
    }
  };

  let currentInput: ResponseInputItem[] = [
    { type: 'message', role: 'user', content: scrubbedMessage },
  ];
  // Local opener never hit the LLM — replay it so the flow chains.
  if (mode === 'chat' && priorOpener && previousResponseId === null) {
    currentInput.unshift({ type: 'message', role: 'assistant', content: priorOpener });
  }
  let currentPreviousId: string | null = previousResponseId;

  // On ONBOARD-* screens expose ONLY the onboarding tools (avoids LLM
  // double-writing via update_profile/navigate_next which target a different
  // sink). Matches path-1 Vapi assistant scope.
  const onboardingTools = getOnboardingTools(screenId);
  const checkinTools = getCheckinTools(screenId, mode);
  // Dashboard / chat / wrap-up screens get TOOL_DEFINITIONS + read-only check-in tools
  // (query_habits, get_summary) so the coach can answer "what are my habits?" / "how was my week?".
  const readOnlyCheckinTools = getReadOnlyCheckinTools(screenId);
  const requestTools =
    mode === 'opener'
      ? getCheckinOpenerTools(screenId)
      : onboardingTools !== undefined
        ? onboardingTools
        : checkinTools !== undefined
          ? checkinTools
          : readOnlyCheckinTools !== undefined
            ? [...DIRECT_LLM_BASE_TOOLS, ...readOnlyCheckinTools]
            : DIRECT_LLM_BASE_TOOLS;
  const allowedToolNames = new Set<string>(requestTools ? requestTools.map((t) => t.name) : []);

  const forceForkChoice = isForkScreen && !pathAlreadySet && mode !== 'opener';
  const forkChoiceTools = forceForkChoice
    ? requestTools?.filter((t) => t.name === 'submit_path_choice' || t.name === 'ask_clarification')
    : undefined;

  waitUntil(writeStartRow());

  // W2-D / F10 live-path: the model sometimes splits ONE brain dump across
  // several submit_brain_dump calls in a single turn (observed 4x/6x live),
  // and the handler overwrites the row per call, so only the LAST chunk
  // survived and the user's other habits silently vanished. Accumulate the
  // turn's chunks and rewrite each call to carry the running union, so the
  // final write always holds the whole dump. Request-scoped on purpose: a
  // correction in a LATER user turn still replaces the dump wholesale.
  let turnBrainDumpChunks: string[] = [];

  // W2-E: same-turn duplicate tool-call dedupe (R20/R21/R26) — request-scoped
  // (spans every round of this turn), exact (name, args) match only.
  // submit_brain_dump is excluded (handled separately by the merge above).
  const toolDedupe = new SameTurnToolDedupe();

  // W_SILENT-FIX lever 1 (see MAX_ROUNDS comment above): per-tool-name
  // failure count + ban set, scoped to this one request/turn.
  const toolFailureCounts = new Map<string, number>();
  const bannedToolNames = new Set<string>();

  try {
    let finished = false;
    for (let round = 0; round < MAX_ROUNDS && !finished; round++) {
      if (clientClosed) {
        // finalize() (outer finally) logs 'cancelled' + skips reportRequestFailure.
        endStatus = 'cancelled';
        endCode = null;
        return;
      }

      const forcingThisRound = forceForkChoice && round === 0;
      // Lever 2: the final allowed round always forces text-only, so a turn
      // about to hit MAX_ROUNDS produces a real reply instead of one more
      // tool call (see the MAX_ROUNDS comment above for the full mechanism).
      const forceTextOnlyThisRound = !forcingThisRound && round === MAX_ROUNDS - 1;
      // Lever 1: drop any tool that has already failed TOOL_FAILURE_BAN_LIMIT
      // times this turn from what's offered — the model can still try a
      // different tool, or (having none left it trusts) answer in words.
      const roundTools = forcingThisRound
        ? forkChoiceTools
        : requestTools?.filter((t) => !bannedToolNames.has(t.name));
      const baseStreamOpts = {
        model: requestModel,
        instructions: systemPrompt,
        input: currentInput,
        tools: roundTools,
        toolChoice: forcingThisRound
          ? ('required' as const)
          : forceTextOnlyThisRound
            ? ('none' as const)
            : undefined,
        store: true,
        signal: abortController.signal,
        // Onboarding turns carry tool JSON on top of text — the 600 default
        // truncated on the habit beats (response.incomplete → B11).
        maxOutputTokens: isOnboardingScreen ? ONBOARDING_MAX_OUTPUT_TOKENS : undefined,
      };

      let stream: AsyncIterable<
        import('../_lib/llm/openai-responses.js').ResponsesStreamEvent
      > | null = null;
      let openErr: unknown = null;
      try {
        stream = await openResponsesStream({
          ...baseStreamOpts,
          previousResponseId: currentPreviousId ?? undefined,
        });
      } catch (err) {
        openErr = err;
      }

      if (!stream && openErr && currentPreviousId && isExpiredPreviousResponse(openErr)) {
        currentPreviousId = null;
        try {
          stream = await openResponsesStream({ ...baseStreamOpts, previousResponseId: undefined });
          openErr = null;
        } catch (retryErr) {
          openErr = retryErr;
        }
      }

      if (!stream) {
        const err = openErr as Error;
        endStatus = 'error';
        endCode = 'openai_error';
        logFailure('open_stream', 'openai_error', err, { round });
        send({
          type: 'error',
          code: 'openai_error',
          message: err?.message ?? 'Unknown error',
          ...debugInfo('open_stream', err),
        });
        await persistChatTurn({ includeAssistant: false });
        await finalize();
        res.end();
        return;
      }

      let assistantContent = '';
      const roundToolCalls: Array<{ callId: string; name: string; argumentsRaw: string }> = [];
      let thisResponseId: string | null = null;
      let streamFailed = false;

      try {
        for await (const evt of stream) {
          switch (evt.type) {
            case 'delta': {
              if (firstDeltaAtMs === null) {
                firstDeltaAtMs = performance.now() - startedAt;
              }
              assistantContent += evt.content;
              send({ type: 'delta', content: evt.content });
              break;
            }
            case 'tool_call': {
              roundToolCalls.push({
                callId: evt.callId,
                name: evt.name,
                argumentsRaw: evt.argumentsRaw,
              });
              break;
            }
            case 'completed': {
              thisResponseId = evt.responseId;
              if (evt.totalTokens) totalTokens = evt.totalTokens;
              break;
            }
            // Truncated terminal (max_output_tokens / content_filter). Treat as
            // a retryable failure: dispatching a possibly-partial tool set or
            // finishing with a half-sentence would silently corrupt the turn —
            // exactly the B11 empty-response wedge at the habit beat.
            case 'incomplete': {
              streamFailed = true;
              if (evt.totalTokens) totalTokens = evt.totalTokens;
              endStatus = clientClosed ? 'cancelled' : 'error';
              endCode = `incomplete_${evt.reason}`;
              logFailure('stream', endCode, undefined, {
                round,
                reason: evt.reason,
                partial_chars: assistantContent.length,
                partial_tool_calls: roundToolCalls.length,
              });
              send({
                type: 'error',
                code: 'incomplete_response',
                message: `response truncated (${evt.reason}) — please retry`,
                ...debugInfo('stream'),
              });
              break;
            }
            case 'error': {
              streamFailed = true;
              endStatus = clientClosed ? 'cancelled' : 'error';
              endCode = evt.code;
              logFailure('stream', evt.code, undefined, { round, upstream: evt.message });
              send({ type: 'error', code: evt.code, message: evt.message, ...debugInfo('stream') });
              break;
            }
          }
          if (streamFailed) break;
        }
      } catch (err) {
        const status = (err as { status?: number }).status;
        const code = err instanceof OpenAIError ? `openai_${status ?? 'error'}` : 'stream_error';
        endStatus = clientClosed ? 'cancelled' : 'error';
        endCode = code;
        logFailure('stream_iterate', code, err, { round });
        send({
          type: 'error',
          code,
          message: (err as Error).message,
          ...debugInfo('stream_iterate', err),
        });
        await persistChatTurn({ includeAssistant: false });
        await finalize();
        res.end();
        return;
      }

      if (streamFailed) {
        await persistChatTurn({ includeAssistant: false });
        await finalize();
        res.end();
        return;
      }

      if (roundToolCalls.length === 0) {
        finalAssistantContent = assistantContent;
        finalResponseId = thisResponseId;
        finished = true;
        break;
      }

      toolRounds++;
      finalAssistantContent = assistantContent;
      finalAssistantToolCalls = roundToolCalls.map((tc) => ({
        id: tc.callId,
        type: 'function',
        function: { name: tc.name, arguments: tc.argumentsRaw || '{}' },
      }));

      const nextInput: ResponseInputItem[] = [];
      for (const tc of roundToolCalls) {
        let args: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(tc.argumentsRaw || '{}');
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            args = parsed as Record<string, unknown>;
          }
        } catch {
          args = {};
        }
        // Same-turn submit_brain_dump chunk merge (see turnBrainDumpChunks
        // above): rewrite this call's raw text to the union of every chunk
        // the turn has produced so far, so the handler's overwrite persists
        // the whole dump instead of only the last fragment.
        if (tc.name === 'submit_brain_dump' && typeof args.brain_dump_raw === 'string') {
          turnBrainDumpChunks = mergeBrainDumpChunks(turnBrainDumpChunks, args.brain_dump_raw);
          const merged = joinBrainDumpChunks(turnBrainDumpChunks);
          if (merged && merged !== args.brain_dump_raw) {
            args = { ...args, brain_dump_raw: merged };
          }
        }

        send({ type: 'tool_call', id: tc.callId, name: tc.name, args });

        let result: ToolResult;
        let dedupeSkipped = false;
        // W2-E: same-turn duplicate tool-call dedupe (R20/R21/R26). An exact
        // repeat of an already-EXECUTED (name, args) pair this request skips
        // re-dispatch and hands the model the first call's real result, so a
        // model that fires the same tool twice reads success and moves on
        // instead of retrying blind or silently abandoning the task. Scoped
        // to genuine dispatch attempts only (not the unknown-tool rejection
        // below), and never applies to the excluded tool set (submit_brain_dump,
        // handled separately by the chunk-merge above).
        if (allowedToolNames.has(tc.name) && toolDedupe.shouldSkip(tc.name, args)) {
          result = toolDedupe.priorResult(tc.name, args) as ToolResult;
          dedupeSkipped = true;
        } else if (bannedToolNames.has(tc.name)) {
          // W_SILENT-FIX lever 1: this tool already failed
          // TOOL_FAILURE_BAN_LIMIT times this turn and was dropped from this
          // round's offered tools — belt-and-suspenders gate in case the
          // model still names it explicitly.
          result = {
            ok: false,
            error: 'tool_disabled_this_turn',
            message: `${tc.name} has already failed repeatedly this turn and is disabled for the rest of this turn. Use a different tool, or reply in words instead.`,
          };
        } else if (!allowedToolNames.has(tc.name)) {
          // Actionable rejection (W2-C): tell the model what IS callable here
          // instead of a bare "unknown", so a wrong-beat call (e.g. firing a
          // later beat's setup tool from the current one) steers back to this
          // screen's own data tool rather than retrying blind or stalling.
          const available = [...allowedToolNames].sort().join(', ') || 'none';
          result = {
            ok: false,
            error: 'unknown_tool',
            message: `Tool ${tc.name} is not available on this screen. Available: ${available}. Capture this screen's data first, using one of the available tools, before doing anything else.`,
          };
        } else if (onboardingTools !== undefined && isOnboardingToolName(tc.name)) {
          // Onboarding screen — dispatch to onboarding handler. Screen context
          // wins over tool-name precedence so overlapping names (update_habit,
          // create_habit, etc.) hit the right table.
          try {
            result = await dispatchOnboardingToolCall(tc.name, args, {
              anon_id: user.anonId,
              screen_id: screenId,
              user_text: userMessage,
              // W2-E: current turn first, then the up-to-2 prior turns
              // (userTextWindow, newest-first from the query), capped at 3
              // total. Lets habit_name_ungrounded ground a confirm-turn call
              // ("yes please add it") against the earlier turn that actually
              // named the habit, not just this turn's own short reply.
              user_text_window: [userMessage, ...(userTextWindow ?? [])].slice(
                0,
                USER_TEXT_WINDOW_SIZE,
              ),
              // W2-H: coach's own recent turns, most-recent-first. addHabit's
              // guard only ever reads this when the current turn is a bare
              // affirmation — see shared.ts's OnboardingHandlerCtx doc.
              assistant_text_window: assistantTextWindow,
            });
          } catch (err) {
            reportToolFailure({
              tool: tc.name,
              anonId: user.anonId,
              errorCode: 'handler_error',
              args,
              error: err,
            });
            result = { ok: false, error: 'handler_error', message: (err as Error).message };
          }
        } else if (
          (checkinTools !== undefined || readOnlyCheckinTools !== undefined) &&
          isCheckinToolName(tc.name)
        ) {
          // Check-in screen OR dashboard/chat screen with the read-only subset —
          // dispatch to check-in handler regardless of whether the tool name
          // also appears in the onboarding registry.
          try {
            result = await dispatchCheckinToolCall(tc.name, args, {
              anon_id: user.anonId,
              tool_call_id: tc.callId,
              dedupLookup,
              timezone,
            });
          } catch (err) {
            reportToolFailure({
              tool: tc.name,
              anonId: user.anonId,
              errorCode: 'handler_error',
              args,
              error: err,
            });
            result = { ok: false, error: 'handler_error', message: (err as Error).message };
          }
        } else if (!TOOL_NAMES.has(tc.name)) {
          result = { ok: false, error: 'unknown_tool', message: `Unknown tool: ${tc.name}` };
        } else {
          try {
            result = await dispatchToolCall(
              {
                auth_user_id: user.authUserId,
                anon_id: user.anonId,
                session_id: sessionId,
                user_turn_id: userTurnId ?? undefined,
                tool_call_id: tc.callId,
                dedupLookup,
              },
              tc.name as ToolName,
              args,
            );
          } catch (err) {
            reportToolFailure({
              tool: tc.name,
              anonId: user.anonId,
              errorCode: 'handler_error',
              args,
              error: err,
            });
            result = { ok: false, error: 'handler_error', message: (err as Error).message };
          }
        }
        // W_SILENT-FIX lever 1: track failures per tool name across the whole
        // turn (every round, whichever branch above produced the failure —
        // gate rejection or handler guard), so a model that keeps hammering
        // one broken tool gets cut off instead of burning every remaining
        // round on it.
        if (!result.ok) {
          const failCount = (toolFailureCounts.get(tc.name) ?? 0) + 1;
          toolFailureCounts.set(tc.name, failCount);
          if (failCount >= TOOL_FAILURE_BAN_LIMIT) {
            bannedToolNames.add(tc.name);
          }
        }
        // Record only genuine dispatch attempts (not a skipped repeat, not the
        // unknown-tool rejection) so the FIRST real execution of a pair is what
        // a later duplicate reuses.
        if (!dedupeSkipped && allowedToolNames.has(tc.name)) {
          toolDedupe.record(tc.name, args, result);
        }
        if (!result.ok && result.error !== 'handler_error') {
          reportToolFailure({
            tool: tc.name,
            anonId: user.anonId,
            errorCode: result.error,
            args,
          });
        }
        const resultJson = JSON.stringify(result);
        send({ type: 'tool_result', id: tc.callId, ok: result.ok, result });
        // Surface a WRITE-tool crash so the client doesn't silently claim success.
        // Read-only / invalid_args / unknown_tool stay tool_result-only.
        if (!result.ok && result.error === 'handler_error' && MUTATING_TOOLS.has(tc.name)) {
          send({
            type: 'tool_failed',
            id: tc.callId,
            name: tc.name,
            error: result.error,
            message: result.message,
          });
        }
        persistedToolRows.push({
          toolCallId: tc.callId,
          toolName: tc.name,
          resultJson,
        });
        nextInput.push({
          type: 'function_call_output',
          call_id: tc.callId,
          output: resultJson,
        });
      }

      // null on partial completion → chain implicitly resets next round.
      currentPreviousId = thisResponseId;
      currentInput = nextInput;
    }

    if (!finished) {
      endStatus = 'tool_cap';
      endCode = 'tool_cap_reached';
      logFailure('rounds', 'tool_cap_reached', undefined, { tool_rounds: toolRounds });
      // The turn must never end with zero coach text — this was the literal
      // "coach goes silent" bug (Mint 2026-07-07 report). Lever 2 (the forced
      // text-only final round, above) means this branch should be rare now,
      // but if it's still hit, use whatever partial text the last round
      // produced, or an authored fallback, and finish the turn as a normal
      // completed reply — not a bare 'error' — so the client renders it like
      // any other coach message instead of degrading to the generic
      // retry bubble (or silently writing nothing at all, as before).
      if (finalAssistantContent.trim().length === 0) {
        finalAssistantContent = TOOL_CAP_FALLBACK_TEXT;
        send({ type: 'delta', content: finalAssistantContent });
      }
      send({
        type: 'done',
        latency_ms: Math.round(performance.now() - startedAt),
        total_tokens: totalTokens,
        tool_rounds: toolRounds,
        ...(firstDeltaAtMs !== null ? { ttft_ms: Math.round(firstDeltaAtMs) } : {}),
      });
      await persistChatTurn();
      res.end();
      waitUntil(finalize());
      return;
    }

    const latencyMs = Math.round(performance.now() - startedAt);
    endStatus = 'ok';
    send({
      type: 'done',
      latency_ms: latencyMs,
      total_tokens: totalTokens,
      tool_rounds: toolRounds,
      ...(firstDeltaAtMs !== null ? { ttft_ms: Math.round(firstDeltaAtMs) } : {}),
    });
    await persistChatTurn();
    res.end();
    waitUntil(finalize());
  } catch (err) {
    const status = (err as { status?: number }).status;
    const code = err instanceof OpenAIError ? `openai_${status ?? 'error'}` : 'internal_error';
    endStatus = clientClosed ? 'cancelled' : 'error';
    endCode = code;
    logFailure('request', code, err);
    send({
      type: 'error',
      code,
      message: (err as Error).message,
      ...debugInfo('request', err),
    });
    await persistChatTurn({ includeAssistant: false });
    await finalize();
    res.end();
  } finally {
    await finalize();
  }
}
