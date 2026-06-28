import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser, setUserContext, handlePreflight } from '../_lib/auth.js';
import { UUID_REGEX } from '../_lib/validation.js';
import type { LLMChatMessage, LLMToolEvent, OnboardingThreadTurn } from '@gg/shared/types/llm';

function isValidChatSessionId(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id);
}
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
// Resume window. UX heuristic, not a security boundary (auth + anon_id scope are).
const SESSION_RECENCY_MINUTES = 720;
const MAX_CONTENT = 8000; // chat_messages.content CHECK
// One anchor row per anon_id (PK is (anon_id, screen_id)) pins the canonical
// onboarding chat_session_id so the thread resumes cross-device, not per-beat.
const ONBOARDING_ANCHOR_SCREEN = 'ONBOARDING';
const isOnboardingScreen = (s: string) => s.startsWith('ONBOARD-');

interface ChatRow {
  id: string;
  turn_index: number;
  role: 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls: unknown;
  tool_call_id: string | null;
  tool_name: string | null;
}

interface LinearRow extends ChatRow {
  created_at: string | Date;
}

interface LinearCursor {
  ts: string;
  turn: number;
  id: string;
}

function encodeCursor(c: LinearCursor): string {
  return Buffer.from(JSON.stringify(c), 'utf8').toString('base64url');
}

function decodeCursor(raw: string): LinearCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.ts === 'string' &&
      typeof parsed.turn === 'number' &&
      typeof parsed.id === 'string' &&
      UUID_REGEX.test(parsed.id)
    ) {
      return { ts: parsed.ts, turn: parsed.turn, id: parsed.id };
    }
  } catch {
    return null;
  }
  return null;
}

function buildHistory(rows: ChatRow[]): LLMChatMessage[] {
  const messages: LLMChatMessage[] = [];
  const assistantById = new Map<string, LLMChatMessage>();
  const toolCallToAssistantId = new Map<string, string>();

  for (const row of rows) {
    if (row.role === 'user') {
      messages.push({ id: row.id, role: 'user', content: row.content ?? '' });
      continue;
    }
    if (row.role === 'assistant') {
      const toolEvents: LLMToolEvent[] = Array.isArray(row.tool_calls)
        ? (
            row.tool_calls as Array<{
              id?: string;
              function?: { name?: string; arguments?: string };
            }>
          ).flatMap((tc) => {
            if (!tc?.id || !tc.function?.name) return [];
            let args: Record<string, unknown> = {};
            try {
              const parsed = JSON.parse(tc.function.arguments ?? '{}');
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                args = parsed as Record<string, unknown>;
              }
            } catch {
              args = {};
            }
            toolCallToAssistantId.set(tc.id, row.id);
            return [{ id: tc.id, name: tc.function.name, args }];
          })
        : [];
      const msg: LLMChatMessage = {
        id: row.id,
        role: 'assistant',
        content: row.content ?? '',
        toolEvents: toolEvents.length > 0 ? toolEvents : undefined,
      };
      assistantById.set(row.id, msg);
      messages.push(msg);
      continue;
    }
    if (row.role === 'tool' && row.tool_call_id) {
      const assistantId = toolCallToAssistantId.get(row.tool_call_id);
      const assistant = assistantId ? assistantById.get(assistantId) : null;
      if (!assistant || !assistant.toolEvents) continue;
      const evt = assistant.toolEvents.find((t) => t.id === row.tool_call_id);
      if (!evt) continue;
      let payload: unknown;
      try {
        payload = row.content ? JSON.parse(row.content) : null;
      } catch {
        payload = row.content;
      }
      const ok =
        payload && typeof payload === 'object' && 'ok' in payload
          ? Boolean((payload as { ok?: unknown }).ok)
          : true;
      evt.result = { ok, payload };
    }
  }

  return messages;
}

// DESC+reverse so long chats keep the latest turns, not the oldest.
async function loadMessages(
  anonId: string,
  chatSessionId: string,
  limit: number,
): Promise<LLMChatMessage[]> {
  const result = await pool.query<ChatRow>(
    `SELECT id, turn_index, role, content, tool_calls, tool_call_id, tool_name
       FROM chat_messages
      WHERE anon_id = $1 AND chat_session_id = $2
      ORDER BY turn_index DESC
      LIMIT $3`,
    [anonId, chatSessionId, limit],
  );
  return buildHistory(result.rows.reverse());
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;

  const raw = req.query['...path'];
  const segments = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const route = segments[0] === '__index' ? '' : segments[0] || '';

  if (route === 'history') return handleHistory(req, res);
  if (route === 'linear') return handleLinearHistory(req, res);
  if (route === 'session') return handleSession(req, res);
  if (route === 'append') return handleAppend(req, res);
  if (route === 'onboarding-thread') return handleOnboardingThread(req, res);
  return res.status(404).json({ error: 'Not found' });
}

// Persist one voice/Vapi turn. Idempotent per (chat_session_id, client_turn_key):
// a turn whose merged text grows across finals re-POSTs the same key and the row's
// content is UPDATEd. Shares the Direct-LLM advisory lock so the two writers never
// collide on turn_index (pg.Pool max:1 does NOT serialize across functions).
async function handleAppend(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireUser(req, res);
  if (!user) return;
  await setUserContext(user.anonId);

  const body = (req.body ?? {}) as Record<string, unknown>;

  const chatSessionId = body.chat_session_id;
  if (!isValidChatSessionId(chatSessionId)) {
    return res.status(400).json({ error: 'chat_session_id must be a UUID' });
  }

  const screenId = body.screen_id;
  if (typeof screenId !== 'string' || screenId.length === 0 || screenId.length > 200) {
    return res.status(400).json({ error: 'screen_id is required (1-200 chars)' });
  }

  const clientTurnKey = body.client_turn_key;
  if (
    typeof clientTurnKey !== 'string' ||
    clientTurnKey.length === 0 ||
    clientTurnKey.length > 200
  ) {
    return res.status(400).json({ error: 'client_turn_key is required (1-200 chars)' });
  }

  const rawRole = body.role;
  if (rawRole !== 'user' && rawRole !== 'ai' && rawRole !== 'assistant') {
    return res.status(400).json({ error: "role must be 'user' | 'ai' | 'assistant'" });
  }
  const role = rawRole === 'ai' ? 'assistant' : rawRole;

  const rawText = typeof body.text === 'string' ? body.text : '';
  const content = rawText.length > 0 ? rawText.slice(0, MAX_CONTENT) : null;
  const mode = body.mode === 'opener' ? 'opener' : 'chat';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [chatSessionId]);

    const baseRes = await client.query<{ base: number }>(
      'SELECT COALESCE(MAX(turn_index) + 1, 0) AS base FROM chat_messages WHERE chat_session_id = $1',
      [chatSessionId],
    );
    const base = baseRes.rows[0].base;

    await client.query(
      `INSERT INTO chat_messages
         (anon_id, chat_session_id, screen_id, turn_index, role, content, mode, client_turn_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (chat_session_id, client_turn_key) WHERE client_turn_key IS NOT NULL
         DO UPDATE SET content = EXCLUDED.content`,
      [user.anonId, chatSessionId, screenId, base, role, content, mode, clientTurnKey],
    );

    if (isOnboardingScreen(screenId)) {
      await client.query(
        `INSERT INTO chat_sessions (anon_id, screen_id, chat_session_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (anon_id, screen_id) DO UPDATE SET last_activity = now()`,
        [user.anonId, ONBOARDING_ANCHOR_SCREEN, chatSessionId],
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // rollback best-effort
    }
    console.error('[/api/chat/append] failed', err);
    return res.status(500).json({ error: 'append_failed' });
  } finally {
    client.release();
  }

  return res.status(200).json({ ok: true });
}

// Resolve the canonical onboarding thread for this anon_id (cross-device, no
// 12h window, no per-beat screen scoping) and return its persisted messages.
// null when onboarding never wrote a turn — the client then mints a fresh id.
async function handleOnboardingThread(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireUser(req, res);
  if (!user) return;
  await setUserContext(user.anonId);

  const anchor = await pool.query<{ chat_session_id: string }>(
    `SELECT chat_session_id FROM chat_sessions
      WHERE anon_id = $1 AND screen_id = $2`,
    [user.anonId, ONBOARDING_ANCHOR_SCREEN],
  );
  const chatSessionId = anchor.rows[0]?.chat_session_id ?? null;
  if (!chatSessionId) {
    return res.status(200).json({ chat_session_id: null, messages: [] });
  }

  // Flat user/assistant turns ordered by turn_index (the single ordering authority);
  // tool rows and empty pure-tool-call assistant rows are not part of the feed.
  const rows = await pool.query<OnboardingThreadTurn>(
    `SELECT id, client_turn_key, role, content, screen_id
       FROM chat_messages
      WHERE anon_id = $1 AND chat_session_id = $2
        AND role IN ('user', 'assistant')
        AND content IS NOT NULL AND length(trim(content)) > 0
      ORDER BY turn_index ASC
      LIMIT $3`,
    [user.anonId, chatSessionId, MAX_LIMIT],
  );
  return res.status(200).json({ chat_session_id: chatSessionId, messages: rows.rows });
}

async function handleLinearHistory(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireUser(req, res);
  if (!user) return;
  await setUserContext(user.anonId);

  let limit = DEFAULT_LIMIT;
  if (typeof req.query.limit === 'string') {
    const parsed = parseInt(req.query.limit, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      return res.status(400).json({ error: `limit must be 1-${MAX_LIMIT}` });
    }
    limit = parsed;
  }

  let cursor: LinearCursor | null = null;
  if (typeof req.query.before === 'string' && req.query.before.length > 0) {
    cursor = decodeCursor(req.query.before);
    if (!cursor) return res.status(400).json({ error: 'invalid before cursor' });
  }

  // created_at::text keeps full microsecond precision in the cursor — Date
  // round-tripping truncates to ms and can skip a same-ms row at a page boundary.
  const cols = `id, turn_index, role, content, tool_calls, tool_call_id, tool_name, created_at::text AS created_at`;
  // Fetch limit+1 to detect older rows. Tiebreak by turn_index: a whole turn
  // (user+assistant+tool) is inserted in ONE txn, so now() gives them the SAME
  // created_at — ordering by id alone (random UUID) scrambles them within a turn.
  const result = cursor
    ? await pool.query<LinearRow>(
        `SELECT ${cols}
           FROM chat_messages
          WHERE anon_id = $1 AND (created_at, turn_index, id) < ($2, $3, $4)
          ORDER BY created_at DESC, turn_index DESC, id DESC
          LIMIT $5`,
        [user.anonId, cursor.ts, cursor.turn, cursor.id, limit + 1],
      )
    : await pool.query<LinearRow>(
        `SELECT ${cols}
           FROM chat_messages
          WHERE anon_id = $1
          ORDER BY created_at DESC, turn_index DESC, id DESC
          LIMIT $2`,
        [user.anonId, limit + 1],
      );

  const hasMore = result.rows.length > limit;
  const page = hasMore ? result.rows.slice(0, limit) : result.rows;
  const oldest = page[page.length - 1];
  const nextCursor =
    hasMore && oldest
      ? encodeCursor({ ts: String(oldest.created_at), turn: oldest.turn_index, id: oldest.id })
      : null;

  // buildHistory wants chronological order; DB returned newest→oldest.
  const messages = buildHistory(page.slice().reverse());
  return res.status(200).json({ messages, next_cursor: nextCursor, has_more: hasMore });
}

async function handleHistory(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireUser(req, res);
  if (!user) return;
  await setUserContext(user.anonId);

  const chatSessionId = req.query.chat_session_id;
  if (!isValidChatSessionId(chatSessionId)) {
    return res.status(400).json({ error: 'chat_session_id must be a UUID' });
  }

  let limit = DEFAULT_LIMIT;
  if (typeof req.query.limit === 'string') {
    const parsed = parseInt(req.query.limit, 10);
    if (!Number.isFinite(parsed) || parsed < 1 || parsed > MAX_LIMIT) {
      return res.status(400).json({ error: `limit must be 1-${MAX_LIMIT}` });
    }
    limit = parsed;
  }

  const messages = await loadMessages(user.anonId, chatSessionId, limit);
  return res.status(200).json({ chat_session_id: chatSessionId, messages });
}

async function handleSession(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const user = await requireUser(req, res);
  if (!user) return;
  await setUserContext(user.anonId);

  const body = (req.body ?? {}) as Record<string, unknown>;
  const screenId = body.screen_id;
  if (typeof screenId !== 'string' || screenId.length === 0 || screenId.length > 200) {
    return res.status(400).json({ error: 'screen_id is required (1-200 chars)' });
  }
  // resume=false → always a clean session (no prior-transcript chain). Used on
  // onboarding screens where the deterministic recap is the only re-entry surface.
  const resume = body.resume !== false;

  const recent = resume
    ? await pool.query<{ chat_session_id: string }>(
        `SELECT chat_session_id, max(created_at) AS last_activity
           FROM chat_messages
          WHERE anon_id = $1 AND screen_id = $2
            AND created_at > now() - make_interval(mins => $3)
          GROUP BY chat_session_id
          ORDER BY last_activity DESC
          LIMIT 1`,
        [user.anonId, screenId, SESSION_RECENCY_MINUTES],
      )
    : null;

  const resumed = recent?.rows[0]?.chat_session_id ?? null;
  if (resumed) {
    const messages = await loadMessages(user.anonId, resumed, DEFAULT_LIMIT);
    return res.status(200).json({ chat_session_id: resumed, messages });
  }

  // Idempotent cold mint: concurrent first-opens collapse to one session.
  const candidate = globalThis.crypto.randomUUID();
  let chatSessionId = candidate;
  try {
    const minted = await pool.query<{ chat_session_id: string }>(
      `INSERT INTO chat_sessions (anon_id, screen_id, chat_session_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (anon_id, screen_id) DO UPDATE
           SET chat_session_id = CASE
                 WHEN $5 AND chat_sessions.last_activity > now() - make_interval(mins => $4)
                   THEN chat_sessions.chat_session_id
                 ELSE EXCLUDED.chat_session_id
               END,
               last_activity = now()
         RETURNING chat_session_id`,
      [user.anonId, screenId, candidate, SESSION_RECENCY_MINUTES, resume],
    );
    chatSessionId = minted.rows[0]?.chat_session_id ?? candidate;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === '42P01') {
      console.warn('[chat/session] chat_sessions missing — run migration 047; using plain mint');
    } else {
      console.error('[chat/session] cold-mint upsert failed', err);
    }
  }

  return res.status(200).json({ chat_session_id: chatSessionId, messages: [] });
}
