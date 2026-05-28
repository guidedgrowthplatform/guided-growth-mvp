import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { getString, invalid, ok, type OnboardingHandlerCtx } from './shared.js';

const NAME_MAX_LEN = 100;

export async function removeHabit(
  ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const nameRaw = getString(args, 'name');
  if (nameRaw === undefined || nameRaw.trim().length === 0) {
    return invalid('name is required');
  }
  if (nameRaw.length > NAME_MAX_LEN) {
    return invalid(`name must be at most ${NAME_MAX_LEN} characters`);
  }

  const target = nameRaw.trim().toLowerCase();

  const existingRes = await pool.query<{
    hc: Record<string, unknown> | null;
    data: Record<string, unknown> | null;
    current_step: number;
  }>(
    `SELECT data->'habitConfigs' AS hc, data, current_step FROM onboarding_states WHERE anon_id = $1`,
    [ctx.anon_id],
  );

  const row0 = existingRes.rows[0];
  const hc = row0?.hc;
  if (!hc || typeof hc !== 'object') {
    return ok({ data: row0?.data ?? {}, current_step: row0?.current_step ?? 0, removed: null });
  }

  const keys = Object.keys(hc);
  const matchKey = keys.find((k) => k.toLowerCase() === target);
  if (!matchKey) {
    return ok({ data: row0?.data ?? {}, current_step: row0?.current_step ?? 0, removed: null });
  }

  const result = await pool.query<{ data: Record<string, unknown>; current_step: number }>(
    `UPDATE onboarding_states
     SET data = jsonb_set(data, '{habitConfigs}', (data->'habitConfigs') - $2::text),
         updated_at = now()
     WHERE anon_id = $1
     RETURNING data, current_step`,
    [ctx.anon_id, matchKey],
  );

  const row = result.rows[0];
  return ok({
    data: row?.data,
    current_step: row?.current_step ?? row0?.current_step ?? 0,
    removed: matchKey,
  });
}
