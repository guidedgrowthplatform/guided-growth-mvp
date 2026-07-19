import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handlePreflight, requireUser } from '../_lib/auth.js';
import pool from '../_lib/db.js';
import {
  DEFAULT_COACH_PROFILE,
  isCoachFeatureEnabled,
  issueCapability,
  loadActiveBeat,
  resolveEffectiveCoachProfile,
} from '../_lib/voice/coachBroker.js';
import {
  endCoachSessionOnHost,
  failCoachSessionBeforeHostTeardown,
  handoffCoachSessionToHost,
} from '../_lib/voice/coachHost.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handlePreflight(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (process.env.COACH_COMPONENT_ENABLED !== 'true')
    return res.status(404).json({ error: 'Not found' });

  const user = await requireUser(req, res);
  if (!user) return;
  const body = (req.body ?? {}) as Record<string, unknown>;
  if (body.surface !== 'onboarding')
    return res.status(403).json({ error: 'coach_beat_not_allowed' });

  try {
    const beat = await loadActiveBeat(user.anonId);
    if (!beat || !isCoachFeatureEnabled(beat.flowId, beat.screenId)) {
      return res.status(403).json({ error: 'coach_beat_not_allowed' });
    }
    const effectiveProfile = resolveEffectiveCoachProfile(body.profileOverride);
    const sessionId = crypto.randomUUID();
    const capabilityJti = crypto.randomUUID();
    const capability = issueCapability({
      sessionId,
      anonId: user.anonId,
      screenId: beat.screenId,
      allowedTools: beat.allowedTools,
      jti: capabilityJti,
    });
    await pool.query(
      `INSERT INTO coach_sessions
       (id, anon_id, surface, flow_id, screen_id, brain_profile, effective_profile_nonsecret, region, state, capability_jti, allowed_tools, completion_recipe)
       VALUES ($1, $2, 'onboarding', $3, $4, $5, $6::jsonb, $7, 'creating', $8, $9::jsonb, $10::jsonb)`,
      [
        sessionId,
        user.anonId,
        beat.flowId,
        beat.screenId,
        DEFAULT_COACH_PROFILE.id,
        JSON.stringify(effectiveProfile),
        process.env.VERCEL_REGION ?? null,
        capabilityJti,
        JSON.stringify(beat.allowedTools),
        JSON.stringify(beat.completionRecipe),
      ],
    );

    let connection;
    try {
      connection = await handoffCoachSessionToHost({
        sessionId,
        capability,
        effectiveProfile,
      });
    } catch (error) {
      let failedStateUpdateError: unknown;
      let hostTeardownError: unknown;
      try {
        await failCoachSessionBeforeHostTeardown(sessionId);
      } catch (failedStateUpdateFailure) {
        failedStateUpdateError = failedStateUpdateFailure;
      } finally {
        try {
          await endCoachSessionOnHost(sessionId);
        } catch (hostTeardownFailure) {
          hostTeardownError = hostTeardownFailure;
        }
      }
      if (failedStateUpdateError) throw failedStateUpdateError;
      if (hostTeardownError) throw hostTeardownError;
      throw error;
    }

    return res.status(201).json({
      sessionId,
      effectiveProfileNonsecret: effectiveProfile,
      roomUrl: connection.roomUrl,
      token: connection.token,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'coach_unavailable';
    return res.status(code === 'invalid_profile_override' ? 400 : 503).json({ error: code });
  }
}
