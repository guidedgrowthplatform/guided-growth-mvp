import pool from '../db.js';
import type { ResponseInputItem } from './openai-responses.js';

const REPLAY_LIMIT = 16;

// Replay text turns when the previous_response_id chain is gone. Tool turns
// dropped — captured data is re-injected via the Already-Filled block.
export async function loadTranscriptForReplay(
  anonId: string,
  chatSessionId: string,
): Promise<ResponseInputItem[]> {
  const r = await pool.query<{ role: string; content: string | null }>(
    `SELECT role, content FROM chat_messages
       WHERE anon_id = $1 AND chat_session_id = $2
         AND role IN ('user', 'assistant') AND content IS NOT NULL
      ORDER BY turn_index DESC
      LIMIT $3`,
    [anonId, chatSessionId, REPLAY_LIMIT],
  );
  return r.rows
    .reverse()
    .filter((row) => (row.content ?? '').trim().length > 0)
    .map((row) => ({
      type: 'message',
      role: row.role === 'assistant' ? 'assistant' : 'user',
      content: row.content as string,
    }));
}
