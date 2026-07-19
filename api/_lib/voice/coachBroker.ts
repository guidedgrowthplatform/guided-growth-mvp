import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import pool, { type Queryable } from '../db.js';
import onboardingCombined from '../../../src/generated/onboarding_combined.json' with { type: 'json' };
import { STEP_OWNERS } from '../llm/onboarding/stepMaps.generated.js';
import { getOnboardingTools } from '../llm/onboarding/registry.js';
import { dispatchOnboardingToolCall } from '../llm/onboarding/dispatch.js';

export type CoachProfile = {
  id: 'tuned-v1' | 'automated-test';
  language: string;
  stt: Record<string, unknown>;
  tts: Record<string, unknown>;
  turnTaking: Record<string, unknown>;
  brain: Record<string, unknown>;
  latency: Record<string, unknown>;
};

export const DEFAULT_COACH_PROFILE: Readonly<CoachProfile> = Object.freeze({
  id: 'tuned-v1',
  language: 'en-US',
  stt: { provider: 'soniox', model: 'stt-rt-v5', prewarm: true, languages: ['en', 'he', 'es'] },
  tts: { provider: 'cartesia', model: 'sonic-3.5-2026-05-04', voice: 'Pro Clone V1' },
  turnTaking: {
    interruption: true,
    cancellation: true,
    smartTurnStart: 0.6,
    smartTurnComplete: 0.58,
  },
  brain: { provider: 'cerebras', model: 'gpt-oss-120b', fallback: 'gemma-4-31b' },
  latency: { targetMs: 1200 },
});

export type CoachCapability = {
  iss: 'gg-app';
  aud: 'gg-coach-host';
  sessionId: string;
  anonId: string;
  screenId: string;
  allowedTools: string[];
  exp: number;
  jti: string;
};

export type CoachCompletionRecipe = {
  captureTool: string;
  advanceTool: 'advance_step';
  targetStep: number;
};

export type CoachRecipeProgress = {
  captured?: boolean;
  advanced?: boolean;
};

type Beat = {
  id: string;
  screenId: string;
  componentType: string;
  meta?: {
    path?: string;
    fill?: { brain?: string; llmActive?: boolean; allowedTools?: string[] };
  };
};

const CAPABILITY_TTL_SECONDS = 5 * 60;
const OVERRIDE_KEYS = new Set(['language']);
const AUTOMATED_TEST_PROFILE: Readonly<CoachProfile> = Object.freeze({
  id: 'automated-test',
  language: 'en-US',
  stt: { provider: 'soniox', model: 'stt-rt-v5' },
  tts: { provider: 'openai', voice: 'alloy' },
  turnTaking: { interruption: true, cancellation: true, endpointingMs: 650 },
  brain: { provider: 'openai', model: 'gpt-5.4-mini' },
  latency: { targetMs: 1200 },
});

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

function capabilitySecret(): string {
  const secret = process.env.COACH_CAPABILITY_SECRET;
  if (!secret || secret.length < 32) throw new Error('coach_capability_unavailable');
  return secret;
}

function sign(encodedPayload: string): string {
  return crypto.createHmac('sha256', capabilitySecret()).update(encodedPayload).digest('base64url');
}

export function issueCapability(claims: Omit<CoachCapability, 'iss' | 'aud' | 'exp'>): string {
  const payload: CoachCapability = {
    iss: 'gg-app',
    aud: 'gg-coach-host',
    ...claims,
    exp: Math.floor(Date.now() / 1000) + CAPABILITY_TTL_SECONDS,
  };
  const encodedPayload = base64url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyCapability(token: unknown): CoachCapability | null {
  if (typeof token !== 'string') return null;
  const [encodedPayload, suppliedSignature, extra] = token.split('.');
  if (!encodedPayload || !suppliedSignature || extra) return null;
  const expectedSignature = sign(encodedPayload);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected))
    return null;
  try {
    const decoded = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as CoachCapability;
    if (
      decoded.iss !== 'gg-app' ||
      decoded.aud !== 'gg-coach-host' ||
      typeof decoded.sessionId !== 'string' ||
      typeof decoded.anonId !== 'string' ||
      typeof decoded.screenId !== 'string' ||
      !Array.isArray(decoded.allowedTools) ||
      typeof decoded.jti !== 'string' ||
      typeof decoded.exp !== 'number' ||
      decoded.exp <= Math.floor(Date.now() / 1000)
    )
      return null;
    return decoded;
  } catch {
    return null;
  }
}

export function isCoachFeatureEnabled(flowId: string, screenId: string): boolean {
  const configured = process.env.COACH_ENABLED_BEATS;
  if (!configured) return false;
  try {
    const entries = JSON.parse(configured) as unknown;
    return Array.isArray(entries) && entries.some((entry) => entry === `${flowId}:${screenId}`);
  } catch {
    return configured
      .split(',')
      .map((entry) => entry.trim())
      .includes(`${flowId}:${screenId}`);
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export function resolveEffectiveCoachProfile(override: unknown): Readonly<CoachProfile> {
  const base =
    process.env.COACH_AUTOMATED_TEST_PROFILE === 'true'
      ? AUTOMATED_TEST_PROFILE
      : DEFAULT_COACH_PROFILE;
  if (override === undefined) return deepFreeze(structuredClone(base));
  if (!override || typeof override !== 'object' || Array.isArray(override))
    throw new Error('invalid_profile_override');
  const entries = Object.entries(override as Record<string, unknown>);
  if (
    entries.some(
      ([key, value]) => !OVERRIDE_KEYS.has(key) || key !== 'language' || typeof value !== 'string',
    )
  ) {
    throw new Error('invalid_profile_override');
  }
  return deepFreeze({
    ...structuredClone(base),
    ...(override as { language?: string }),
  });
}

function getCurrentBeat(currentStep: number, path: string | null): Beat | null {
  const lane = path === 'braindump' ? 'braindump' : 'simple';
  const componentType = STEP_OWNERS[currentStep]?.[lane];
  if (!componentType) return null;
  return (
    (onboardingCombined.beats as Beat[]).find((beat) => beat.componentType === componentType) ??
    null
  );
}

function completionRecipeFor(beat: Beat): CoachCompletionRecipe | null {
  switch (beat.screenId) {
    case 'ONBOARD-01--FORM':
      return { captureTool: 'submit_profile', advanceTool: 'advance_step', targetStep: 2 };
    case 'ONBOARD-BEGINNER-01':
      return { captureTool: 'submit_category', advanceTool: 'advance_step', targetStep: 4 };
    default:
      return null;
  }
}

export function validateRecipeTransition(
  recipe: CoachCompletionRecipe,
  progress: CoachRecipeProgress,
  name: string,
  args: unknown,
): boolean {
  if (name !== recipe.advanceTool) return true;
  const targetStep = (args as { target_step?: unknown } | null)?.target_step;
  return progress.captured === true && targetStep === recipe.targetStep;
}

export async function loadActiveBeat(anonId: string): Promise<{
  flowId: string;
  screenId: string;
  allowedTools: string[];
  completionRecipe: CoachCompletionRecipe;
} | null> {
  const result = await pool.query<{
    current_step: number;
    path: string | null;
    status: string;
    data: { flowId?: unknown; flowVersion?: unknown } | null;
  }>(
    `SELECT current_step, path, status, data FROM onboarding_states WHERE anon_id = $1 AND status = 'in_progress'`,
    [anonId],
  );
  const state = result.rows[0];
  if (!state) return null;
  const persistedFlowId = state.data?.flowId;
  if (persistedFlowId !== onboardingCombined.flowId) return null;
  const beat = getCurrentBeat(state.current_step, state.path);
  if (
    !beat ||
    beat.meta?.path !== 'path-3-direct-llm' ||
    beat.meta.fill?.brain !== 'direct-llm' ||
    beat.meta.fill.llmActive !== true
  ) {
    return null;
  }
  const allowedTools =
    beat.meta.fill.allowedTools ??
    getOnboardingTools(beat.screenId)?.map((tool) => tool.name) ??
    [];
  const completionRecipe = completionRecipeFor(beat);
  if (
    !completionRecipe ||
    !allowedTools.includes(completionRecipe.captureTool) ||
    !allowedTools.includes(completionRecipe.advanceTool)
  ) {
    return null;
  }
  return {
    flowId: onboardingCombined.flowId,
    screenId: beat.screenId,
    allowedTools,
    completionRecipe,
  };
}

export async function withRlsBoundTransaction<T>(
  anonId: string,
  action: (client: Queryable) => Promise<T>,
): Promise<T> {
  const client = (await pool.connect()) as PoolClient;
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE authenticated');
    await client.query("SELECT set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ anon_id: anonId, role: 'authenticated' }),
    ]);
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function runBoundOnboardingTool(
  claims: CoachCapability,
  name: string,
  args: unknown,
  session: { flowId: string; allowedTools: string[]; completionRecipe: CoachCompletionRecipe },
): Promise<{ result: Awaited<ReturnType<typeof dispatchOnboardingToolCall>>; readBack: unknown }> {
  if (!session.allowedTools.includes(name)) throw new Error('tool_not_allowed');
  return withRlsBoundTransaction(claims.anonId, async (client) => {
    const sessionState = await client.query<{ recipe_progress: CoachRecipeProgress | null }>(
      `SELECT recipe_progress FROM coach_sessions
       WHERE id = $1 AND anon_id = $2 AND flow_id = $3 AND screen_id = $4 AND capability_jti = $5 AND state = 'active'
       FOR UPDATE`,
      [claims.sessionId, claims.anonId, session.flowId, claims.screenId, claims.jti],
    );
    const recipeProgress = sessionState.rows[0]?.recipe_progress ?? {};
    if (!sessionState.rows[0]) throw new Error('session_not_active');
    if (!validateRecipeTransition(session.completionRecipe, recipeProgress, name, args)) {
      throw new Error('recipe_order_violation');
    }
    const result = await dispatchOnboardingToolCall(name, args, {
      anon_id: claims.anonId,
      screen_id: claims.screenId,
      db: client,
    });
    if (result.ok && name === session.completionRecipe.captureTool) {
      await client.query(
        `UPDATE coach_sessions
         SET recipe_progress = recipe_progress || '{"captured":true}'::jsonb
         WHERE id = $1`,
        [claims.sessionId],
      );
    }
    if (result.ok && name === session.completionRecipe.advanceTool) {
      await client.query(
        `UPDATE coach_sessions
         SET recipe_progress = recipe_progress || '{"advanced":true}'::jsonb
         WHERE id = $1`,
        [claims.sessionId],
      );
    }
    const readBack = await client.query(
      'SELECT anon_id, current_step FROM onboarding_states WHERE anon_id = $1',
      [claims.anonId],
    );
    return { result, readBack: readBack.rows[0] ?? null };
  });
}
