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
  if (route === 'session') return handleSession(req, res);
  return res.status(404).json({ error: 'Not found' });
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
  const chatSessionId = resumed ?? globalThis.crypto.randomUUID();
  const messages = resumed ? await loadMessages(user.anonId, chatSessionId, DEFAULT_LIMIT) : [];

  return res.status(200).json({ chat_session_id: chatSessionId, messages });
}
