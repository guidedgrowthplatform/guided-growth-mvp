import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { PATH_OPTIONS } from '../schemas.js';
import { getString, invalid, ok, type OnboardingHandlerCtx } from './shared.js';

function isPathOption(v: string): boolean {
  return (PATH_OPTIONS as readonly string[]).includes(v);
}

export async function submitPathChoice(
  ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const path = getString(args, 'path');
  if (path === undefined || path.length === 0) {
    return invalid('path is required');
  }
  if (!isPathOption(path)) {
    return invalid(`path must be one of ${PATH_OPTIONS.join(', ')}`);
  }

  const result = await pool.query<{ data: Record<string, unknown>; current_step: number; path: string }>(
    `INSERT INTO onboarding_states (anon_id, current_step, path, status, data, updated_at)
     VALUES ($1, 3, $2, 'in_progress', '{}'::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       current_step = GREATEST(onboarding_states.current_step, 3),
       path = $2,
       status = 'in_progress',
       updated_at = now()
     RETURNING data, current_step, path`,
    [ctx.anon_id, path],
  );

  const row = result.rows[0];
  return ok({
    data: row?.data ?? {},
    current_step: row?.current_step ?? 3,
    path: row?.path ?? path,
  });
}
