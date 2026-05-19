import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser, setUserContext, handlePreflight } from '../_lib/auth.js';
import { checkRateLimit } from '../_lib/rate-limit.js';
import { getClientIp } from '../_lib/validation.js';
import { scrubPII } from '../_lib/pii-scrubber.js';
import {
  TOOL_DEFINITIONS,
  dispatchToolCall,
  type ToolName,
  type ToolResult,
} from '../_lib/llm/tools.js';
import {
  openChatCompletionStream,
  getOpenAIKey,
  OpenAIError,
  type ChatCompletionMessage,
  type OpenAIStreamChunk,
} from '../_lib/llm/openai.js';
import {
  buildSystemPromptForRequest,
  BuildSystemPromptError,
} from '../_lib/llm/buildSystemPrompt.js';

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
const MAX_RETRY = 2;

interface AssembledToolCall {
  id: string;
  name: string;
  argsRaw: string;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;

  // Only the bare /api/llm route is valid here.
  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : segments[0] || '';
  if (route !== '') {
    return res.status(404).json({ error: 'Not found' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Surface missing key as JSON 500 before SSE opens.
  try {
    getOpenAIKey();
  } catch (err) {
    return res.status(500).json({ error: (err as Error).message });
  }

  // Per-IP
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
  await setUserContext(user.authUserId);

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

  // Body validation
  const body = (req.body ?? {}) as Record<string, unknown>;
  const sessionId = body.session_id;
  if (typeof sessionId !== 'string' || sessionId.trim().length < 8) {
    return res.status(400).json({ error: 'session_id must be a string of at least 8 chars' });
  }
  const screenId = body.screen_id;
  if (typeof screenId !== 'string' || screenId.length === 0 || screenId.length > 200) {
    return res.status(400).json({ error: 'screen_id is required (1-200 chars)' });
  }
  const userMessage = body.user_message;
  if (typeof userMessage !== 'string' || userMessage.length === 0 || userMessage.length > 2000) {
    return res.status(400).json({ error: 'user_message is required (1-2000 chars)' });
  }
  let coachingStyle: CoachingStyle = 'warm';
  if (body.coaching_style !== undefined) {
    if (typeof body.coaching_style !== 'string' || !COACHING_STYLES.has(body.coaching_style as CoachingStyle)) {
      return res.status(400).json({ error: 'invalid coaching_style' });
    }
    coachingStyle = body.coaching_style as CoachingStyle;
  }

  const scrubbedMessage = scrubPII(userMessage);

  // Build before logging start so unknown_screen_id returns JSON 404, not SSE.
  let systemPrompt: string;
  try {
    const built = await buildSystemPromptForRequest({
      anon_id: user.anonId,
      screen_id: screenId,
      coaching_style: coachingStyle,
    });
    systemPrompt = built.systemPrompt;
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        '[/api/llm] prompt assembled',
        JSON.stringify({
          screen_id: screenId,
          coaching_style: coachingStyle,
          context_version: built.contextVersion,
          delta_count: built.deltaCount,
          system_prompt_chars: systemPrompt.length,
        }),
      );
      console.log('[/api/llm] system_prompt:\n' + systemPrompt);
      console.log('[/api/llm] user_message:', scrubbedMessage);
    }
  } catch (err) {
    if (err instanceof BuildSystemPromptError) {
      return res.status(err.status).json({ error: err.code, message: err.message });
    }
    return res.status(500).json({ error: 'build_system_prompt_failed', message: (err as Error).message });
  }

  try {
    await pool.query(
      `INSERT INTO session_log (anon_id, session_id, event_type, screen_id, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        user.anonId,
        sessionId,
        'llm_call',
        screenId,
        { phase: 'start', screen_id: screenId, coaching_style: coachingStyle, model: 'gpt-4o-mini' },
      ],
    );
  } catch (err) {
    return res.status(500).json({ error: `Failed to log llm_call start: ${(err as Error).message}` });
  }

  // Open SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  // Abort OpenAI fetch on client disconnect.
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
          },
        ],
      );
    } catch {
      // best-effort
    }
  };

  const messages: ChatCompletionMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: scrubbedMessage },
  ];

  try {
    let finished = false;
    for (let round = 0; round < MAX_ROUNDS && !finished; round++) {
      if (clientClosed) return;
      // Eager fetch + per-round retry for 429
      let stream: AsyncIterable<OpenAIStreamChunk> | null = null;
      let lastErr: unknown = null;
      for (let attempt = 0; attempt <= MAX_RETRY; attempt++) {
        try {
          stream = await openChatCompletionStream({
            messages,
            tools: TOOL_DEFINITIONS,
            signal: abortController.signal,
          });
          lastErr = null;
          break;
        } catch (err) {
          lastErr = err;
          const status = (err as { status?: number }).status;
          if (status === 429 && attempt < MAX_RETRY) {
            await sleep(attempt === 0 ? 300 : 900);
            continue;
          }
          break;
        }
      }
      if (!stream) {
        const err = lastErr as Error;
        endStatus = 'error';
        endCode = 'openai_error';
        send({ type: 'error', code: 'openai_error', message: err?.message ?? 'Unknown error' });
        res.end();
        return;
      }

      let assistantContent = '';
      const toolCallMap = new Map<number, AssembledToolCall>();
      let finishReason: 'stop' | 'length' | 'tool_calls' | null = null;

      try {
        for await (const chunk of stream) {
          if (chunk.usage?.total_tokens) {
            totalTokens = chunk.usage.total_tokens;
          }
          const choice = chunk.choices?.[0];
          if (!choice) continue;
          const delta = choice.delta || {};
          if (typeof delta.content === 'string' && delta.content.length > 0) {
            assistantContent += delta.content;
            send({ type: 'delta', content: delta.content });
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              let existing = toolCallMap.get(idx);
              if (!existing) {
                existing = { id: tc.id ?? '', name: tc.function?.name ?? '', argsRaw: '' };
                toolCallMap.set(idx, existing);
              }
              if (tc.id && !existing.id) existing.id = tc.id;
              if (tc.function?.name && !existing.name) existing.name = tc.function.name;
              if (typeof tc.function?.arguments === 'string') {
                existing.argsRaw += tc.function.arguments;
              }
            }
          }
          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
          }
        }
      } catch (err) {
        const status = (err as { status?: number }).status;
        const code = err instanceof OpenAIError ? `openai_${status ?? 'error'}` : 'stream_error';
        endStatus = clientClosed ? 'cancelled' : 'error';
        endCode = code;
        send({ type: 'error', code, message: (err as Error).message });
        res.end();
        return;
      }

      if (finishReason === 'tool_calls' && toolCallMap.size > 0) {
        toolRounds++;
        const assembled = Array.from(toolCallMap.values()).filter((t) => t.id && t.name);

        // Append assistant message carrying the tool_calls
        messages.push({
          role: 'assistant',
          content: assistantContent.length > 0 ? assistantContent : null,
          tool_calls: assembled.map((t) => ({
            id: t.id,
            type: 'function',
            function: { name: t.name, arguments: t.argsRaw || '{}' },
          })),
        });

        for (const tc of assembled) {
          let args: Record<string, unknown> = {};
          try {
            const parsed = JSON.parse(tc.argsRaw || '{}');
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              args = parsed as Record<string, unknown>;
            }
          } catch {
            args = {};
          }
          send({ type: 'tool_call', id: tc.id, name: tc.name, args });

          let result: ToolResult;
          if (!TOOL_NAMES.has(tc.name)) {
            result = { ok: false, error: 'unknown_tool', message: `Unknown tool: ${tc.name}` };
          } else {
            try {
              result = await dispatchToolCall(
                { auth_user_id: user.authUserId, anon_id: user.anonId, session_id: sessionId },
                tc.name as ToolName,
                args,
              );
            } catch (err) {
              result = { ok: false, error: 'handler_error', message: (err as Error).message };
            }
          }
          send({ type: 'tool_result', id: tc.id, ok: result.ok, result });
          messages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(result),
          });
        }
        continue;
      }

      // stop / length / no tool calls
      finished = true;
    }

    if (!finished) {
      endStatus = 'tool_cap';
      endCode = 'tool_cap_reached';
      send({ type: 'error', code: 'tool_cap_reached', message: 'Exceeded max tool rounds (5)' });
      res.end();
      return;
    }

    const latencyMs = Math.round(performance.now() - startedAt);
    endStatus = 'ok';
    send({ type: 'done', latency_ms: latencyMs, total_tokens: totalTokens, tool_rounds: toolRounds });
    res.end();
  } catch (err) {
    const status = (err as { status?: number }).status;
    const code = err instanceof OpenAIError ? `openai_${status ?? 'error'}` : 'internal_error';
    endStatus = clientClosed ? 'cancelled' : 'error';
    endCode = code;
    send({ type: 'error', code, message: (err as Error).message });
    res.end();
  } finally {
    await writeEndRow();
  }
}
