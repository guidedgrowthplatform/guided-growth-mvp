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
  'ONBOARD-ADV-CUSTOM': (r) =>
    Array.isArray(r.data?.customPrompts) && r.data.customPrompts.length > 0,
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
  'ONBOARD-ADV-CUSTOM': 6,
};

// Inverse of the flow: trusted (current_step, path) -> the source screen the
// user is ON. Vapi's navigate_next supplies only target_step, so it derives the
// source here rather than trusting the LLM's requested target. Steps 1-2 are
// pre-fork (path-agnostic); step >= 3 splits on path.
export function sourceScreenForStep(
  currentStep: number,
  path: string | null,
  data?: Record<string, unknown> | null,
): string | undefined {
  if (currentStep === 1) return 'ONBOARD-01--FORM';
  if (currentStep === 2) return 'ONBOARD-FORK--FORM';
  if (path === 'braindump') {
    if (currentStep === 5) {
      // Two possible step-5 pages: the custom-prompts editor (ONBOARD-ADV-CUSTOM)
      // when the user chose custom prompts, else reflection setup (ONBOARD-ADVANCED-04).
      const hasPrompts = Array.isArray(data?.customPrompts) && data.customPrompts.length > 0;
      return hasPrompts && !isObject(data?.reflectionConfig)
        ? 'ONBOARD-ADV-CUSTOM'
        : 'ONBOARD-ADVANCED-04';
    }
    return { 3: 'ONBOARD-ADVANCED', 4: 'ONBOARD-ADVANCED-02' }[currentStep];
  }
  // Null path past the fork = corrupted row; fail closed, never gate as beginner.
  if (path === null) return undefined;
  return {
    3: 'ONBOARD-BEGINNER-01',
    4: 'ONBOARD-BEGINNER-02',
    5: 'ONBOARD-BEGINNER-03',
    6: 'ONBOARD-BEGINNER-07',
  }[currentStep];
}

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

export type AtomicAdvanceResult =
  | {
      advanced: false;
      reason: 'required_missing' | 'no_next_step' | 'no_source_screen' | 'out_of_sequence';
    }
  | { advanced: true; current_step: number };

// Atomic navigate for navigate_next: EVERY decision (back-nav vs forward vs
// out-of-sequence, source screen, gate, write) runs against ONE FOR-UPDATE-
// locked row, so no concurrent submit/advance can change current_step or path
// between the decision and the write. Forward is exact-next only (target ==
// locked step + 1); a larger target is rejected, so repeated calls can't chain
// past unseen screens. target <= locked step is the documented back-nav WRITE
// (assistant RULE 3): realtime on current_step is what drives client
// navigation, so an ack without a write would leave the user stranded.
export async function advanceStepIfReadyAtomic(
  anonId: string,
  targetStep: number,
): Promise<AtomicAdvanceResult> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query<Row>(
      `SELECT data, path, current_step FROM onboarding_states WHERE anon_id = $1 FOR UPDATE`,
      [anonId],
    );
    const row = res.rows[0] ?? { data: null, path: null, current_step: null };
    const lockedStep = row.current_step ?? 1;

    if (targetStep <= lockedStep) {
      // Deliberate non-monotonic write: back-nav/lateral to an already-passed
      // screen. Can't skip anything — every step <= lockedStep was gated on the
      // way up, and returning forward re-runs the gates.
      const moved = await client.query<{ current_step: number }>(
        `UPDATE onboarding_states SET current_step = $2, updated_at = now()
         WHERE anon_id = $1 RETURNING current_step`,
        [anonId, targetStep],
      );
      await client.query('COMMIT');
      return { advanced: true, current_step: moved.rows[0]?.current_step ?? targetStep };
    }

    if (targetStep > lockedStep + 1) {
      await client.query('ROLLBACK');
      return { advanced: false, reason: 'out_of_sequence' };
    }

    const screenId = sourceScreenForStep(lockedStep, row.path, row.data);
    if (!screenId) {
      await client.query('ROLLBACK');
      return { advanced: false, reason: 'no_source_screen' };
    }

    const requiredSatisfied = REQUIRED[screenId]?.(row) ?? true;
    if (!requiredSatisfied) {
      await client.query('ROLLBACK');
      return { advanced: false, reason: 'required_missing' };
    }

    const nextStep = NEXT_STEP[screenId];
    if (nextStep === undefined) {
      await client.query('ROLLBACK');
      return { advanced: false, reason: 'no_next_step' };
    }

    const bumped = await client.query<{ current_step: number }>(
      `UPDATE onboarding_states SET current_step = GREATEST(current_step, $2), updated_at = now()
       WHERE anon_id = $1 RETURNING current_step`,
      [anonId, nextStep],
    );
    await client.query('COMMIT');
    return { advanced: true, current_step: bumped.rows[0]?.current_step ?? nextStep };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

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
