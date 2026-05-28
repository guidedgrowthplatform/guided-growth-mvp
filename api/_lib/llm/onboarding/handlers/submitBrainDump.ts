import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { getString, invalid, ok, type OnboardingHandlerCtx } from './shared.js';

const BRAIN_DUMP_MIN_LEN = 10;
const BRAIN_DUMP_MAX_LEN = 5000;

export async function submitBrainDump(
  ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const brainDumpRaw = getString(args, 'brain_dump_raw');
  if (brainDumpRaw === undefined) return invalid('brain_dump_raw is required');
  if (brainDumpRaw.trim().length < BRAIN_DUMP_MIN_LEN) {
    return invalid(`brain_dump_raw must be at least ${BRAIN_DUMP_MIN_LEN} characters`);
  }
  if (brainDumpRaw.length > BRAIN_DUMP_MAX_LEN) {
    return invalid(`brain_dump_raw must be at most ${BRAIN_DUMP_MAX_LEN} characters`);
  }

  const payload = JSON.stringify({ brainDumpText: brainDumpRaw });

  const result = await pool.query<{
    data: Record<string, unknown>;
    current_step: number;
    brain_dump_raw: string;
  }>(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, brain_dump_raw, updated_at)
     VALUES ($1, 4, 'in_progress', $2::jsonb, $3, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       current_step = GREATEST(onboarding_states.current_step, 4),
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       brain_dump_raw = $3,
       updated_at = now()
     RETURNING data, current_step, brain_dump_raw`,
    [ctx.anon_id, payload, brainDumpRaw],
  );

  const row = result.rows[0];
  return ok({
    data: row?.data ?? { brainDumpText: brainDumpRaw },
    current_step: row?.current_step ?? 4,
    brain_dump_raw: row?.brain_dump_raw ?? brainDumpRaw,
  });
}
