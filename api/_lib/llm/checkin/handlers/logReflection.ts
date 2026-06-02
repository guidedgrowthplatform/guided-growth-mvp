import type { ToolResult } from '../../tools.js';
import { createJournalEntry } from '../../../journal/createJournalEntry.js';
import { REFLECTION_TEXT_MAX_LEN, REFLECTION_TITLE_MAX_LEN } from '../schemas.js';
import { checkDedup, getString, invalid, ok, todayStr, type CheckinHandlerCtx } from './shared.js';

export async function logReflection(
  ctx: CheckinHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const cached = await checkDedup(ctx);
  if (cached) return cached;

  const text = getString(args, 'text')?.trim();
  if (!text) return invalid('text is required');
  if (text.length > REFLECTION_TEXT_MAX_LEN) {
    return invalid(`text must be at most ${REFLECTION_TEXT_MAX_LEN} characters`);
  }

  const title = getString(args, 'title')?.trim();
  if (title && title.length > REFLECTION_TITLE_MAX_LEN) {
    return invalid(`title must be at most ${REFLECTION_TITLE_MAX_LEN} characters`);
  }

  const date = todayStr(ctx.timezone);
  const entry = await createJournalEntry({
    anon_id: ctx.anon_id,
    type: 'freeform',
    title: title || null,
    date,
    fields: { body: text },
  });

  return ok({ logged: true, date, entry_id: entry.id });
}
