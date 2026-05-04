import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { handlePreflight, requireUser } from '../_lib/auth.js';
import { captureServerEvent } from '../_lib/posthog-server.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireUser(req, res);
  if (!user) return;

  const stateResult = await pool.query(
    'SELECT current_step, path, status FROM onboarding_states WHERE user_id = $1',
    [user.id],
  );
  const state = stateResult.rows[0] as
    | { current_step: number; path: string | null; status: 'in_progress' | 'completed' }
    | undefined;

  if (!state || state.status !== 'in_progress') {
    return res.json({ ok: true, skipped: true });
  }

  const body = (req.body ?? {}) as {
    lastStepNumber?: number;
    lastStepName?: string;
    onboardingPath?: string | null;
  };

  await captureServerEvent('drop_off_onboarding', user.id, {
    last_step_number: body.lastStepNumber ?? state.current_step,
    last_step_name: body.lastStepName ?? `step_${state.current_step}`,
    onboarding_path: body.onboardingPath ?? state.path ?? null,
  });

  return res.json({ ok: true });
}
