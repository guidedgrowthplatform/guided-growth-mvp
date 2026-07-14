import {
  DEFAULT_REFLECTION_PROMPTS,
  type HabitType,
  type ReflectionSettings,
} from '@gg/shared/types';
import pool, { type Queryable } from '../db.js';
import { supabaseAdmin } from '../supabase.js';
import {
  sanitizeDays,
  sanitizePrompts,
  upsertReflectionSettings,
} from '../reflection/reflectionSettings.js';

type HabitConfig = {
  days?: number[] | Set<number>;
  time?: string;
  reminder?: boolean;
  habitType?: HabitType;
};

export type CompleteOnboardingResult =
  | { ok: true; completed: true; alreadyCompleted: boolean }
  | { ok: false; reason: 'no_state' };

// Single atomic completion op keyed by anon_id: flips the row to completed,
// promotes habits, materializes profile + reflection settings, syncs auth
// metadata. Callable from the REST endpoint (has authUserId) and both LLM lanes
// (anon_id only — authUserId is resolved from profiles.anon_id, see below).
//
// setPlanConfirmed writes data.plan.confirmed=true (the canonical render marks
// confirm_plan explicitly); the REST path leaves it to the client's finalData.
// mergeData is the endpoint's existing finalData carry.
export async function completeOnboarding(opts: {
  anonId: string;
  mergeData?: Record<string, unknown>;
  setPlanConfirmed?: boolean;
  // Run inside a caller-owned transaction (batched Vapi tool-call txn / tests).
  // When set, this function does NOT manage BEGIN/COMMIT/ROLLBACK.
  executor?: Queryable;
}): Promise<CompleteOnboardingResult> {
  const { anonId, mergeData, setPlanConfirmed, executor } = opts;
  if (executor) {
    return runCompletion(executor, anonId, mergeData, setPlanConfirmed);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await runCompletion(client, anonId, mergeData, setPlanConfirmed);
    if (!result.ok) {
      await client.query('ROLLBACK');
      return result;
    }
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function runCompletion(
  client: Queryable,
  anonId: string,
  mergeData: Record<string, unknown> | undefined,
  setPlanConfirmed: boolean | undefined,
): Promise<CompleteOnboardingResult> {
  // Idempotency: a completed row short-circuits before any promotion/insert so a
  // re-confirm is a safe no-op success (habit inserts already used ON CONFLICT,
  // but skipping avoids redundant auth/profile writes on the LLM retry path).
  const pre = await client.query<{ status: string | null }>(
    `SELECT status FROM onboarding_states WHERE anon_id = $1`,
    [anonId],
  );
  if (pre.rows.length === 0) return { ok: false, reason: 'no_state' };
  if (pre.rows[0].status === 'completed') {
    return { ok: true, completed: true, alreadyCompleted: true };
  }

  const planMerge = setPlanConfirmed ? { plan: { confirmed: true } } : {};
  const finalMerge = { ...(mergeData ?? {}), ...planMerge };

  const stateResult = await client.query<{
    path: string | null;
    data: Record<string, unknown> | null;
  }>(
    `UPDATE onboarding_states
       SET data = onboarding_states.data || $2::jsonb,
           status = 'completed', completed_at = now(), updated_at = now()
     WHERE anon_id = $1
     RETURNING path, data`,
    [anonId, JSON.stringify(finalMerge)],
  );
  if (stateResult.rows.length === 0) return { ok: false, reason: 'no_state' };

  const { path: onboardingPath, data } = stateResult.rows[0];
  const safeData = (data ?? {}) as Record<string, unknown>;

  await promoteHabits(client, anonId, safeData);
  const authUserId = await resolveAuthUserId(client, anonId);
  await materializeProfile(client, authUserId, onboardingPath, safeData);
  await materializeReflection(client, anonId, safeData);
  await syncAuthMetadata(authUserId, safeData);

  return { ok: true, completed: true, alreadyCompleted: false };
}

// habitConfigs (beginner) + advancedHabitConfigs (braindump) both promote — the
// old REST endpoint only did habitConfigs, silently dropping advanced-lane habits.
async function promoteHabits(
  client: Queryable,
  anonId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const beginner = data.habitConfigs as Record<string, HabitConfig> | undefined;
  const advanced = data.advancedHabitConfigs as Record<string, HabitConfig> | undefined;
  const merged: Record<string, HabitConfig> = { ...(advanced ?? {}), ...(beginner ?? {}) };

  let sortOrder = 0;
  for (const [name, config] of Object.entries(merged)) {
    // Trust the explicit per-habit signal only. A category heuristic
    // ("Break bad habits") mislabels positive replacement habits as avoid.
    const habitType: HabitType = config.habitType === 'binary_avoid' ? 'binary_avoid' : 'binary_do';
    const days = config.days instanceof Set ? Array.from(config.days) : (config.days ?? null);
    await client.query(
      `INSERT INTO user_habits (anon_id, name, habit_type, cadence, schedule_days, reminder_time, reminder_enabled, sort_order)
       VALUES ($1, $2, $3, 'daily', $4, $5, $6, $7)
       ON CONFLICT (anon_id, name) DO UPDATE SET
         schedule_days = EXCLUDED.schedule_days,
         reminder_time = EXCLUDED.reminder_time,
         reminder_enabled = EXCLUDED.reminder_enabled,
         sort_order = EXCLUDED.sort_order`,
      [anonId, name, habitType, days, config.time || null, config.reminder || false, sortOrder++],
    );
  }
}

// profiles.anon_id is the bridge to auth.users.id (migration 025). LLM lanes only
// carry anon_id, so the auth id for profile + metadata writes is resolved here.
async function resolveAuthUserId(client: Queryable, anonId: string): Promise<string | null> {
  const res = await client.query<{ id: string }>(`SELECT id FROM profiles WHERE anon_id = $1`, [
    anonId,
  ]);
  return res.rows[0]?.id ?? null;
}

async function materializeProfile(
  client: Queryable,
  authUserId: string | null,
  onboardingPath: string | null,
  data: Record<string, unknown>,
): Promise<void> {
  if (!authUserId) {
    console.warn('[completeOnboarding] no profile for anon_id — skipping profile write');
    return;
  }
  const ageRange = data.ageRange;
  const age = data.age;
  const referralSource = data.referralSource;
  await client.query(
    `UPDATE profiles SET
       onboarding_path = $1,
       nickname = COALESCE($3, profiles.nickname),
       age_group = COALESCE($4, profiles.age_group),
       gender = COALESCE($5, profiles.gender),
       referral_source = COALESCE($6, profiles.referral_source)
     WHERE id = $2`,
    [
      onboardingPath,
      authUserId,
      (data.nickname as string) || null,
      // age_group is VARCHAR(20). Legacy `ageRange` string wins; else coerce the
      // numeric `age` to string to satisfy the column type.
      typeof ageRange === 'string' && ageRange.length > 0
        ? ageRange
        : typeof age === 'number' && Number.isFinite(age)
          ? String(age)
          : null,
      (data.gender as string) || null,
      typeof referralSource === 'string' && referralSource.length <= 50 ? referralSource : null,
    ],
  );
}

async function materializeReflection(
  client: Queryable,
  anonId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const rc = data.reflectionConfig as
    | { time?: string; days?: number[]; reminder?: boolean; schedule?: string }
    | undefined;
  const mode = data.reflectionMode === 'freeform' ? 'freeform' : 'prompts';
  const customPrompts = sanitizePrompts(data.customPrompts);
  const weeklyConfig = data.weeklyConfig as { day?: number } | undefined;
  const weeklyDay =
    typeof weeklyConfig?.day === 'number' &&
    Number.isInteger(weeklyConfig.day) &&
    weeklyConfig.day >= 0 &&
    weeklyConfig.day <= 6
      ? weeklyConfig.day
      : 0;
  const reflectionSettings: ReflectionSettings = {
    mode,
    prompts:
      mode === 'prompts' ? (customPrompts.length ? customPrompts : DEFAULT_REFLECTION_PROMPTS) : [],
    time: typeof rc?.time === 'string' ? rc.time : null,
    days: sanitizeDays(rc?.days),
    reminder: typeof rc?.reminder === 'boolean' ? rc.reminder : true,
    schedule: typeof rc?.schedule === 'string' ? rc.schedule : null,
    weeklyDay,
  };
  await upsertReflectionSettings(anonId, reflectionSettings, client);
}

// Best-effort: auth metadata is outside the DB transaction and cannot roll back.
// A failure here shouldn't strand a completed row, so it's logged, not thrown.
async function syncAuthMetadata(
  authUserId: string | null,
  data: Record<string, unknown>,
): Promise<void> {
  if (!authUserId || !data.nickname) return;
  try {
    await supabaseAdmin.auth.admin.updateUserById(authUserId, {
      user_metadata: { nickname: data.nickname as string },
    });
  } catch (err) {
    console.error('[completeOnboarding] auth metadata sync failed (non-fatal):', err);
  }
}
