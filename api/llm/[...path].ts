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
import { dispatchOnboardingToolCall } from '../_lib/llm/onboarding/dispatch.js';
import { getOnboardingTools } from '../_lib/llm/onboarding/registry.js';
import { isOnboardingToolName } from '../_lib/llm/onboarding/schemas.js';
import { detectAffirmation } from '@gg/shared/onboarding/detectAffirmation';
import { screenKind } from '@gg/shared/onboarding/screenKind';
import { advanceStepIfReady } from '../_lib/llm/onboarding/handlers/confirmStepComplete.js';
import { dispatchCheckinToolCall } from '../_lib/llm/checkin/dispatch.js';
import { getCheckinTools, getReadOnlyCheckinTools } from '../_lib/llm/checkin/registry.js';
import { isCheckinToolName } from '../_lib/llm/checkin/schemas.js';
import { getOpenAIKey, OpenAIError } from '../_lib/llm/openai.js';
import { openResponsesStream, type ResponseInputItem } from '../_lib/llm/openai-responses.js';
import { handleParseBrainDump } from '../_lib/llm/parseBrainDump.js';
import { buildSystemPromptForRequest } from '../_lib/llm/buildSystemPrompt.js';
import { reportToolFailure, reportRequestFailure, flushSentry } from '../_lib/sentry.js';
import type { SessionStateDeltaEntry } from '@gg/shared/types/context';

type CoachingStyle = 'warm' | 'direct' | 'reflective';
const COACHING_STYLES = new Set<CoachingStyle>(['warm', 'direct', 'reflective']);
const TOOL_NAMES = new Set<string>(TOOL_DEFINITIONS.map((t) => t.name));

type LLMStreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'tool_call'; id: string; name: string; args: Record<string, unknown> }
  | { type: 'tool_result'; id: string; ok: boolean; result: unknown }
  | { type: 'done'; latency_ms: number; total_tokens: number; tool_rounds: number }
  | { type: 'error'; code: string; message: string };

const MAX_ROUNDS = 5;
const ONBOARDING_MODEL = 'gpt-4o';
const FORK_SCREEN_ID = 'ONBOARD-FORK--FORM';

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
  if (route !== '' && route !== 'parse-brain-dump') {
    return res.status(404).json({ error: 'Not found' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    getOpenAIKey();
  } catch (err) {
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

  const timezone = validateTimezone(body.timezone) ?? 'UTC';

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

  const isOnboardingScreen = screenId.startsWith('ONBOARD-');
  const requestModel: string | undefined = isOnboardingScreen ? ONBOARDING_MODEL : undefined;
  // Onboarding captures real name/age/brain-dump — scrubbing would destroy the
  // signal. Stored raw in chat_messages (see CLAUDE.md gotcha #8).
  const scrubbedMessage = isOnboardingScreen ? userMessage : scrubPII(userMessage);

  const isForkScreen = screenId === FORK_SCREEN_ID;

  let systemPrompt: string;
  let previousResponseId: string | null = null;
  let foreignOwned: boolean;
  let pathAlreadySet = false;
  try {
    const [built, ownerRow, forkPathRow] = await Promise.all([
      buildSystemPromptForRequest({
        anon_id: user.anonId,
        screen_id: screenId,
        coaching_style: coachingStyle,
        recent_events: recentEvents,
        mode,
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
    ]);
    systemPrompt = built.systemPrompt;
    previousResponseId = ownerRow?.prev_response_id ?? null;
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
    return res
      .status(500)
      .json({ error: 'build_system_prompt_failed', message: (err as Error).message });
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
  let currentPreviousId: string | null = previousResponseId;

  // On ONBOARD-* screens expose ONLY the onboarding tools (avoids LLM
  // double-writing via update_profile/navigate_next which target a different
  // sink). Matches path-1 Vapi assistant scope.
  const onboardingTools = getOnboardingTools(screenId);
  const checkinTools = getCheckinTools(screenId);
  // Dashboard / chat / wrap-up screens get TOOL_DEFINITIONS + read-only check-in tools
  // (query_habits, get_summary) so the coach can answer "what are my habits?" / "how was my week?".
  const readOnlyCheckinTools = getReadOnlyCheckinTools(screenId);
  const requestTools =
    mode === 'opener'
      ? undefined
      : onboardingTools !== undefined
        ? onboardingTools
        : checkinTools !== undefined
          ? checkinTools
          : readOnlyCheckinTools !== undefined
            ? [...TOOL_DEFINITIONS, ...readOnlyCheckinTools]
            : TOOL_DEFINITIONS;
  const allowedToolNames = new Set<string>(requestTools ? requestTools.map((t) => t.name) : []);

  const forceForkChoice = isForkScreen && !pathAlreadySet && mode !== 'opener';
  const forkChoiceTools = forceForkChoice
    ? requestTools?.filter((t) => t.name === 'submit_path_choice' || t.name === 'ask_clarification')
    : undefined;

  await writeStartRow();

  try {
    let finished = false;
    for (let round = 0; round < MAX_ROUNDS && !finished; round++) {
      if (clientClosed) return;

      const forcingThisRound = forceForkChoice && round === 0;
      const baseStreamOpts = {
        model: requestModel,
        instructions: systemPrompt,
        input: currentInput,
        tools: forcingThisRound ? forkChoiceTools : requestTools,
        toolChoice: forcingThisRound ? ('required' as const) : undefined,
        store: true,
        signal: abortController.signal,
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
        send({ type: 'error', code: 'openai_error', message: err?.message ?? 'Unknown error' });
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
            case 'error': {
              streamFailed = true;
              endStatus = clientClosed ? 'cancelled' : 'error';
              endCode = evt.code;
              send({ type: 'error', code: evt.code, message: evt.message });
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
        send({ type: 'error', code, message: (err as Error).message });
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
        // No tool call this turn — deterministic onboarding advance on bare affirmation.
        // toolRounds === 0 → no tools across the whole request (no double-fire after a real tool).
        if (isOnboardingScreen && mode === 'chat' && toolRounds === 0) {
          const aff = detectAffirmation(userMessage, screenKind(screenId));
          if (aff.affirmed) {
            const bump = await advanceStepIfReady(user.anonId, screenId);
            if (bump.advanced) {
              const synthId = `srv-confirm-${user.anonId}-${screenId}`;
              send({ type: 'tool_call', id: synthId, name: 'confirm_step_complete', args: {} });
              send({
                type: 'tool_result',
                id: synthId,
                ok: true,
                result: { ok: true, result: { advance: true, current_step: bump.current_step } },
              });
            }
          }
        }
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
        send({ type: 'tool_call', id: tc.callId, name: tc.name, args });

        let result: ToolResult;
        if (!allowedToolNames.has(tc.name)) {
          result = {
            ok: false,
            error: 'unknown_tool',
            message: `Tool ${tc.name} not available on this screen`,
          };
        } else if (onboardingTools !== undefined && isOnboardingToolName(tc.name)) {
          // Onboarding screen — dispatch to onboarding handler. Screen context
          // wins over tool-name precedence so overlapping names (update_habit,
          // create_habit, etc.) hit the right table.
          try {
            result = await dispatchOnboardingToolCall(tc.name, args, {
              anon_id: user.anonId,
              screen_id: screenId,
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
      send({ type: 'error', code: 'tool_cap_reached', message: 'Exceeded max tool rounds (5)' });
      await persistChatTurn({ includeAssistant: false });
      await finalize();
      res.end();
      return;
    }

    await persistChatTurn();
    const latencyMs = Math.round(performance.now() - startedAt);
    endStatus = 'ok';
    send({
      type: 'done',
      latency_ms: latencyMs,
      total_tokens: totalTokens,
      tool_rounds: toolRounds,
    });
    await finalize();
    res.end();
  } catch (err) {
    const status = (err as { status?: number }).status;
    const code = err instanceof OpenAIError ? `openai_${status ?? 'error'}` : 'internal_error';
    endStatus = clientClosed ? 'cancelled' : 'error';
    endCode = code;
    send({ type: 'error', code, message: (err as Error).message });
    await persistChatTurn({ includeAssistant: false });
    await finalize();
    res.end();
  } finally {
    await finalize();
  }
}
