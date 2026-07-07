import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { inferSchedule, type ScheduleOption } from '../../tools.onboarding.js';
import { SCHEDULE_OPTIONS } from '../schemas.js';
import {
  getBoolean,
  getNumberArray,
  getString,
  handlerError,
  invalid,
  ok,
  TIME_REGEX,
  type OnboardingHandlerCtx,
} from './shared.js';
import { checkSetupConfigGuard, SURFACES } from './setupConfigGuard.js';

function isScheduleOption(v: string): boolean {
  return (SCHEDULE_OPTIONS as readonly string[]).includes(v);
}

// Same upsert shape (step pin, status, jsonb merge) as the config save below,
// but merging only the skip marker — never a fabricated config.
async function markMorningCheckinSkipped(anonId: string): Promise<void> {
  await pool.query(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
     VALUES ($1, 7, 'in_progress', $2::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       current_step = GREATEST(onboarding_states.current_step, 7),
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       updated_at = now()`,
    [anonId, JSON.stringify({ morningCheckinSkipped: true })],
  );
}

// Persist the morning check-in schedule on ONBOARD-MORNING-SETUP. Same validation
// and merge shape as submitReflectionConfig, written under the `morningCheckin`
// key at onboarding step 7.
export async function submitMorningCheckin(
  ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  // B58 server-side guard: an explicit refusal ("I don't want a morning thing
  // at all") or a turn with no real config content must not save. Proven
  // live twice that the prompt-only DATA INTEGRITY law does not stop the
  // model from calling this tool with default args in the same turn as the
  // refusal (see setupConfigGuard.ts doc comment). Skips entirely when the
  // caller has no raw turn text (backward compatible, same as addHabit's
  // habit_name_ungrounded convention).
  const guard = checkSetupConfigGuard(SURFACES.morning, ctx.user_text);
  if (guard.blocked) {
    // An explicit refusal is a TERMINAL answer for this beat, not a missing
    // one: persist a lightweight skip marker so the morning-checkin-setup
    // advance gate (preconditions.ts) lets the flow leave the beat. Without
    // it the beat is inescapable after a refusal, and the model retries this
    // tool on later turns where unrelated time/day content (e.g. the evening
    // reflection's time) can pass the guard and silently save a config the
    // user already declined (!478 follow-up finding). config_not_grounded is
    // NOT terminal — an off-topic turn is not an answer — so it writes
    // nothing. A later genuine save overrides the marker: the gate checks
    // morningCheckin first.
    if (guard.code === 'config_refused_by_user') {
      await markMorningCheckinSkipped(ctx.anon_id);
    }
    return handlerError(guard.code);
  }

  const time = getString(args, 'time');
  if (time === undefined || !TIME_REGEX.test(time)) {
    return invalid('time must be HH:MM in 24-hour format');
  }

  const daysRaw = getNumberArray(args, 'days');
  if (daysRaw === undefined) return invalid('days must be an array of integers 0-6');
  for (const d of daysRaw) {
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      return invalid('each day must be an integer 0-6');
    }
  }
  const days = Array.from(new Set(daysRaw)).sort((a, b) => a - b);

  const reminder = getBoolean(args, 'reminder');
  if (reminder === undefined) return invalid('reminder must be a boolean');

  const scheduleRaw = getString(args, 'schedule');
  if (scheduleRaw === undefined || !isScheduleOption(scheduleRaw)) {
    return invalid(`schedule must be one of ${SCHEDULE_OPTIONS.join(', ')}`);
  }

  // Reconcile: days is authoritative, schedule kept in sync so a stale label from
  // LLM drift lands corrected. Falls back to the LLM-supplied label when days is a
  // custom combination.
  const schedule: ScheduleOption = inferSchedule(days) ?? (scheduleRaw as ScheduleOption);

  const morningCheckin = { time, days, reminder, schedule };
  const payload = JSON.stringify({ morningCheckin });

  const result = await pool.query<{ data: Record<string, unknown>; current_step: number }>(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
     VALUES ($1, 7, 'in_progress', $2::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       current_step = GREATEST(onboarding_states.current_step, 7),
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       updated_at = now()
     RETURNING data, current_step`,
    [ctx.anon_id, payload],
  );

  const row = result.rows[0];
  return ok({
    data: row?.data ?? { morningCheckin },
    current_step: row?.current_step ?? 7,
    morningCheckin,
  });
}
