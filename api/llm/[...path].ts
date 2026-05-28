import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser, setUserContext, handlePreflight } from '../_lib/auth.js';
import { checkRateLimit } from '../_lib/rate-limit.js';
import { getClientIp, UUID_REGEX } from '../_lib/validation.js';
import { scrubPII } from '../_lib/pii-scrubber.js';
import {
  TOOL_DEFINITIONS,
  dispatchToolCall,
  type ToolName,
  type ToolResult,
} from '../_lib/llm/tools.js';
import { getOpenAIKey, OpenAIError } from '../_lib/llm/openai.js';
import { openResponsesStream, type ResponseInputItem } from '../_lib/llm/openai-responses.js';
import {
  buildSystemPromptForRequest,
  BuildSystemPromptError,
} from '../_lib/llm/buildSystemPrompt.js';
import type { SessionStateDeltaEntry } from '@shared/types/context.js';
import { runOnboardingTurn } from '../_lib/llm/onboardingTurn.js';

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
  if (route === 'onboarding') {
    return handleOnboardingTurn(req, res);
  }
  if (route !== '') {
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
  const scrubbedMessage = isOnboardingScreen ? userMessage : scrubPII(userMessage);

  let systemPrompt: string;
  let previousResponseId: string | null = null;
  let foreignOwned: boolean;
  try {
    const [built, ownerRow] = await Promise.all([
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
    ]);
    systemPrompt = built.systemPrompt;
    previousResponseId = ownerRow?.prev_response_id ?? null;
    foreignOwned = ownerRow?.foreign_owned ?? false;
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
    if (err instanceof BuildSystemPromptError) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
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
            model: 'gpt-4o-mini',
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

  try {
    let finished = false;
    for (let round = 0; round < MAX_ROUNDS && !finished; round++) {
      if (clientClosed) return;

      let stream: AsyncIterable<
        import('../_lib/llm/openai-responses.js').ResponsesStreamEvent
      > | null = null;
      let openErr: unknown = null;
      try {
        stream = await openResponsesStream({
          instructions: systemPrompt,
          input: currentInput,
          tools: mode === 'opener' ? undefined : TOOL_DEFINITIONS,
          previousResponseId: currentPreviousId ?? undefined,
          store: true,
          signal: abortController.signal,
        });
      } catch (err) {
        openErr = err;
      }

      if (!stream && openErr && currentPreviousId && isExpiredPreviousResponse(openErr)) {
        currentPreviousId = null;
        try {
          stream = await openResponsesStream({
            instructions: systemPrompt,
            input: currentInput,
            tools: mode === 'opener' ? undefined : TOOL_DEFINITIONS,
            previousResponseId: undefined,
            store: true,
            signal: abortController.signal,
          });
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
        res.end();
        return;
      }

      if (streamFailed) {
        await persistChatTurn({ includeAssistant: false });
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
        send({ type: 'tool_call', id: tc.callId, name: tc.name, args });

        let result: ToolResult;
        if (!TOOL_NAMES.has(tc.name)) {
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
            result = { ok: false, error: 'handler_error', message: (err as Error).message };
          }
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
    res.end();
  } catch (err) {
    const status = (err as { status?: number }).status;
    const code = err instanceof OpenAIError ? `openai_${status ?? 'error'}` : 'internal_error';
    endStatus = clientClosed ? 'cancelled' : 'error';
    endCode = code;
    send({ type: 'error', code, message: (err as Error).message });
    await persistChatTurn({ includeAssistant: false });
    res.end();
  } finally {
    await Promise.allSettled([writeStartRow(), writeEndRow()]);
  }
}

// POST /api/llm/onboarding — multi-action structured onboarding turn (non-streaming).
async function handleOnboardingTurn(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req.headers);
  const ipRl = checkRateLimit(ip, { windowMs: 60_000, maxRequests: 30, keyPrefix: 'llm-ip' });
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

  const body = (req.body ?? {}) as Record<string, unknown>;

  const screenId = body.screen_id;
  if (typeof screenId !== 'string' || screenId.length === 0 || screenId.length > 200) {
    return res.status(400).json({ error: 'screen_id is required (1-200 chars)' });
  }

  const userMessage = body.user_message;
  if (typeof userMessage !== 'string' || userMessage.length > 2000) {
    return res.status(400).json({ error: 'user_message must be a string (≤2000 chars)' });
  }

  let options: string[] = [];
  if (body.options !== undefined) {
    if (!Array.isArray(body.options) || !body.options.every((o) => typeof o === 'string')) {
      return res.status(400).json({ error: 'options must be an array of strings' });
    }
    options = body.options as string[];
  }

  let filledFields: Record<string, unknown> = {};
  if (body.filled_fields !== undefined) {
    if (
      typeof body.filled_fields !== 'object' ||
      body.filled_fields === null ||
      Array.isArray(body.filled_fields)
    ) {
      return res.status(400).json({ error: 'filled_fields must be a plain object' });
    }
    filledFields = body.filled_fields as Record<string, unknown>;
  }

  const step = typeof body.step === 'number' ? body.step : undefined;

  try {
    const result = await runOnboardingTurn({
      screenId,
      step,
      text: userMessage,
      options,
      filledFields,
    });
    return res.status(200).json(result);
  } catch (err) {
    console.error('[/api/llm/onboarding] failed', err);
    return res.status(502).json({ error: (err as Error).message });
  }
}
