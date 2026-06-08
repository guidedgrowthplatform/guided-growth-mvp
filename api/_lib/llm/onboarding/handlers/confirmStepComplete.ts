import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { ok, type OnboardingHandlerCtx } from './shared.js';

type Row = {
  data: Record<string, unknown> | null;
  path: string | null;
  current_step: number | null;
};

// Min field that must exist before a screen may advance. Unmapped → allow.
export const REQUIRED: Record<string, (row: Row) => boolean> = {
  'ONBOARD-01--FORM': (r) =>
    typeof r.data?.nickname === 'string' &&
    r.data.nickname.length > 0 &&
    typeof r.data?.age === 'number' &&
    typeof r.data?.gender === 'string' &&
    r.data.gender.length > 0 &&
    typeof r.data?.referralSource === 'string' &&
    r.data.referralSource.length > 0,
  'ONBOARD-FORK--FORM': (r) => typeof r.path === 'string' && r.path.length > 0,
  'ONBOARD-BEGINNER-01': (r) => typeof r.data?.category === 'string' && r.data.category.length > 0,
  'ONBOARD-BEGINNER-02': (r) => Array.isArray(r.data?.goals) && r.data.goals.length > 0,
  'ONBOARD-BEGINNER-03': (r) => hasHabit(r),
  'ONBOARD-BEGINNER-07': (r) => isObject(r.data?.reflectionConfig),
  'ONBOARD-ADVANCED': (r) =>
    typeof r.data?.brainDumpText === 'string' && r.data.brainDumpText.trim().length > 0,
  'ONBOARD-ADVANCED-04': (r) => isObject(r.data?.reflectionConfig),
};

// Value = that screen's page currentStep + 1 (the immediately-next screen). A
// wrong value skips a screen. GREATEST in the UPDATE never lowers current_step.
export const NEXT_STEP: Record<string, number> = {
  'ONBOARD-01--FORM': 2,
  'ONBOARD-FORK--FORM': 3,
  'ONBOARD-BEGINNER-01': 4,
  'ONBOARD-BEGINNER-02': 5,
  'ONBOARD-BEGINNER-03': 6,
  'ONBOARD-BEGINNER-07': 7,
  'ONBOARD-ADVANCED': 4,
  'ONBOARD-ADVANCED-02': 5,
  'ONBOARD-ADVANCED-03': 6,
  'ONBOARD-ADVANCED-04': 6,
};

function isObject(v: unknown): boolean {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hasHabit(r: Row): boolean {
  const hc = r.data?.habitConfigs;
  return isObject(hc) && Object.keys(hc as Record<string, unknown>).length > 0;
}

export type AdvanceResult =
  | { advanced: false; reason: 'required_missing' | 'no_next_step' }
  | { advanced: true; current_step: number };

export async function advanceStepIfReady(anonId: string, screenId: string): Promise<AdvanceResult> {
  const res = await pool.query<Row>(
    `SELECT data, path, current_step FROM onboarding_states WHERE anon_id = $1`,
    [anonId],
  );
  const row = res.rows[0] ?? { data: null, path: null, current_step: null };

  const requiredSatisfied = REQUIRED[screenId]?.(row) ?? true;
  if (!requiredSatisfied) return { advanced: false, reason: 'required_missing' };

  const nextStep = NEXT_STEP[screenId];
  if (nextStep === undefined) return { advanced: false, reason: 'no_next_step' };

  const bumped = await pool.query<{ current_step: number }>(
    `UPDATE onboarding_states SET current_step = GREATEST(current_step, $2), updated_at = now()
     WHERE anon_id = $1 RETURNING current_step`,
    [anonId, nextStep],
  );
  return { advanced: true, current_step: bumped.rows[0]?.current_step ?? nextStep };
}

export async function confirmStepComplete(
  ctx: OnboardingHandlerCtx,
  _args: Record<string, unknown>,
): Promise<ToolResult> {
  const screenId = ctx.screen_id;
  // Unmapped on both fronts: advance without reading the row.
  if (!screenId || (!REQUIRED[screenId] && NEXT_STEP[screenId] === undefined)) {
    return ok({ advance: true });
  }

  const res = await advanceStepIfReady(ctx.anon_id, screenId);
  if (res.advanced) return ok({ advance: true, current_step: res.current_step });
  // no_next_step here means REQUIRED-mapped but absent from NEXT_STEP (config gap):
  // advancing with no current_step would no-op useAgentNavigation and strand the user.
  const reason =
    res.reason === 'required_missing'
      ? 'required field missing for this step'
      : 'no next step configured for this screen';
  return ok({ advance: false, reason });
}
