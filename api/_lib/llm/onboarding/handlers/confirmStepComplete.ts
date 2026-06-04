import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { ok, type OnboardingHandlerCtx } from './shared.js';

type Row = { data: Record<string, unknown> | null; path: string | null };

// Min field that must exist before a screen may advance. Unmapped → allow.
const REQUIRED: Record<string, (row: Row) => boolean> = {
  'ONBOARD-01--FORM': (r) => typeof r.data?.nickname === 'string' && r.data.nickname.length > 0,
  'ONBOARD-FORK--FORM': (r) => typeof r.path === 'string' && r.path.length > 0,
  'ONBOARD-BEGINNER-01': (r) => typeof r.data?.category === 'string' && r.data.category.length > 0,
  'ONBOARD-BEGINNER-02': (r) => Array.isArray(r.data?.goals) && r.data.goals.length > 0,
  'ONBOARD-BEGINNER-03': (r) => hasHabit(r),
  'ONBOARD-BEGINNER-07': (r) => isObject(r.data?.reflectionConfig),
  'ONBOARD-ADVANCED': (r) =>
    typeof r.data?.brainDumpText === 'string' && r.data.brainDumpText.trim().length > 0,
  'ONBOARD-ADVANCED-04': (r) => isObject(r.data?.reflectionConfig),
};

function isObject(v: unknown): boolean {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hasHabit(r: Row): boolean {
  const hc = r.data?.habitConfigs;
  return isObject(hc) && Object.keys(hc as Record<string, unknown>).length > 0;
}

export async function confirmStepComplete(
  ctx: OnboardingHandlerCtx,
  _args: Record<string, unknown>,
): Promise<ToolResult> {
  const check = ctx.screen_id ? REQUIRED[ctx.screen_id] : undefined;
  if (!check) return ok({ advance: true });

  const res = await pool.query<Row>(`SELECT data, path FROM onboarding_states WHERE anon_id = $1`, [
    ctx.anon_id,
  ]);
  const row = res.rows[0] ?? { data: null, path: null };
  if (!check(row)) {
    return ok({ advance: false, reason: 'required field missing for this step' });
  }
  return ok({ advance: true });
}
