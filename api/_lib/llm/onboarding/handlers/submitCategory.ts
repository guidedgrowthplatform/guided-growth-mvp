import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { CATEGORY_OPTIONS } from '../schemas.js';
import { getString, invalid, ok, type OnboardingHandlerCtx } from './shared.js';

function isCategoryOption(v: string): boolean {
  return (CATEGORY_OPTIONS as readonly string[]).includes(v);
}

export async function submitCategory(
  ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const category = getString(args, 'category');
  if (category === undefined || category.length === 0) {
    return invalid('category is required');
  }
  if (!isCategoryOption(category)) {
    return invalid(`category must be one of ${CATEGORY_OPTIONS.join(', ')}`);
  }

  const payload = JSON.stringify({ category });

  const result = await pool.query<{ data: Record<string, unknown>; current_step: number }>(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
     VALUES ($1, 4, 'in_progress', $2::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       current_step = GREATEST(onboarding_states.current_step, 4),
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       updated_at = now()
     RETURNING data, current_step`,
    [ctx.anon_id, payload],
  );

  const row = result.rows[0];
  return ok({ data: row?.data ?? { category }, current_step: row?.current_step ?? 4 });
}
