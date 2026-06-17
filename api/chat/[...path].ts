import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { requireUser, setUserContext, handlePreflight } from '../_lib/auth.js';
import { UUID_REGEX } from '../_lib/validation.js';
import type { LLMChatMessage, LLMToolEvent } from '@gg/shared/types/llm';

function isValidChatSessionId(id: unknown): id is string {
  return typeof id === 'string' && UUID_REGEX.test(id);
}
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
// Resume window. UX heuristic, not a security boundary (auth + anon_id scope are).
const SESSION_RECENCY_MINUTES = 720;

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
  return res.status(404).json({ error: 'Not found' });
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
      console.warn('[chat/session] chat_sessions missing — run migration 044; using plain mint');
    } else {
      console.error('[chat/session] cold-mint upsert failed', err);
    }
  }

  return res.status(200).json({ chat_session_id: chatSessionId, messages: [] });
}
