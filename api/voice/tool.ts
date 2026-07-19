import type { VercelRequest, VercelResponse } from '@vercel/node';
import pool from '../_lib/db.js';
import { handlePreflight } from '../_lib/auth.js';
import {
  isCoachFeatureEnabled,
  loadActiveBeat,
  runBoundOnboardingTool,
  verifyCapability,
  type CoachCompletionRecipe,
} from '../_lib/voice/coachBroker.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (process.env.COACH_COMPONENT_ENABLED !== 'true')
    return res.status(404).json({ error: 'Not found' });
  const body = (req.body ?? {}) as Record<string, unknown>;
  const claims = verifyCapability(body.capability);
  if (!claims) return res.status(401).json({ error: 'invalid_capability' });
  if (typeof body.name !== 'string') return res.status(400).json({ error: 'invalid_tool_request' });

  const session = await pool.query<{
    anon_id: string;
    flow_id: string;
    screen_id: string;
    state: string;
    capability_jti: string;
    allowed_tools: string[];
    completion_recipe: CoachCompletionRecipe;
  }>(
    `SELECT anon_id, flow_id, screen_id, state, capability_jti, allowed_tools, completion_recipe FROM coach_sessions WHERE id = $1`,
    [claims.sessionId],
  );
  const row = session.rows[0];
  if (
    !row ||
    row.anon_id !== claims.anonId ||
    row.screen_id !== claims.screenId ||
    row.capability_jti !== claims.jti ||
    row.state !== 'active'
  ) {
    return res.status(403).json({ error: 'session_not_active' });
  }
  const beat = await loadActiveBeat(claims.anonId);
  if (
    !beat ||
    beat.flowId !== row.flow_id ||
    beat.screenId !== claims.screenId ||
    !isCoachFeatureEnabled(beat.flowId, beat.screenId) ||
    !beat.allowedTools.includes(body.name) ||
    !row.allowed_tools.includes(body.name)
  ) {
    return res.status(403).json({ error: 'stale_or_forbidden_beat' });
  }

  try {
    const output = await runBoundOnboardingTool(claims, body.name, body.args, {
      flowId: row.flow_id,
      allowedTools: row.allowed_tools,
      completionRecipe: row.completion_recipe,
    });
    return res.status(200).json(output);
  } catch (error) {
    const code = error instanceof Error ? error.message : 'tool_dispatch_failed';
    return res
      .status(
        code === 'tool_not_allowed' ||
          code === 'recipe_order_violation' ||
          code === 'session_not_active'
          ? 403
          : 500,
      )
      .json({ error: code });
  }
}
