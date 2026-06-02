import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { inferSchedule, SCHEDULE_DAYS, type ScheduleOption } from '../../tools.onboarding.js';
import { SCHEDULE_OPTIONS } from '../schemas.js';
import {
  getBoolean,
  getNumberArray,
  getString,
  invalid,
  ok,
  TIME_REGEX,
  type OnboardingHandlerCtx,
} from './shared.js';

const NAME_MAX_LEN = 100;

type HabitEntry = { days?: number[]; time?: string; reminder?: boolean; schedule?: string };

function isScheduleOption(v: string): boolean {
  return (SCHEDULE_OPTIONS as readonly string[]).includes(v);
}

// Partial patch — preserves fields the user didn't change, unlike add_habit.
export async function updateHabit(
  ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const nameRaw = getString(args, 'name');
  if (nameRaw === undefined || nameRaw.trim().length === 0) return invalid('name is required');
  if (nameRaw.length > NAME_MAX_LEN) {
    return invalid(`name must be at most ${NAME_MAX_LEN} characters`);
  }
  const target = nameRaw.trim().toLowerCase();

  const existingRes = await pool.query<{
    hc: Record<string, HabitEntry> | null;
    current_step: number;
  }>(`SELECT data->'habitConfigs' AS hc, current_step FROM onboarding_states WHERE anon_id = $1`, [
    ctx.anon_id,
  ]);
  const row0 = existingRes.rows[0];
  const hc = row0?.hc;
  // Idempotent on miss: advanced flow holds habits in nav state until
  // completion, so they aren't in habitConfigs yet. Return ok (not an error)
  // so the client voice-action still fires (Step5 patch / edit-habit nav).
  if (!hc || typeof hc !== 'object') return ok({ updated: null });
  const matchKey = Object.keys(hc).find((k) => k.toLowerCase() === target);
  if (!matchKey) return ok({ updated: null });
  const existing = hc[matchKey] ?? {};

  const patch: HabitEntry = {};

  const daysRaw = getNumberArray(args, 'days');
  if (daysRaw !== undefined) {
    for (const d of daysRaw) {
      if (!Number.isInteger(d) || d < 0 || d > 6) return invalid('each day must be an integer 0-6');
    }
    const days = Array.from(new Set(daysRaw)).sort((a, b) => a - b);
    patch.days = days;
    // Days authoritative — keep schedule label in sync (mirrors addHabit).
    patch.schedule = inferSchedule(days) ?? existing.schedule ?? 'Weekday';
  }

  const time = getString(args, 'time');
  if (time !== undefined) {
    if (!TIME_REGEX.test(time)) return invalid('time must be HH:MM in 24-hour format');
    patch.time = time;
  }

  const reminder = getBoolean(args, 'reminder');
  if (reminder !== undefined) patch.reminder = reminder;

  // schedule without days: expand the preset into its day set.
  const scheduleRaw = getString(args, 'schedule');
  if (scheduleRaw !== undefined && patch.days === undefined) {
    if (!isScheduleOption(scheduleRaw)) {
      return invalid(`schedule must be one of ${SCHEDULE_OPTIONS.join(', ')}`);
    }
    patch.schedule = scheduleRaw;
    patch.days = [...SCHEDULE_DAYS[scheduleRaw as ScheduleOption]];
  }

  if (Object.keys(patch).length === 0) {
    return invalid('provide at least one field to update (days, time, reminder, or schedule)');
  }

  const merged = { ...existing, ...patch };
  const mergePayload = JSON.stringify({ [matchKey]: merged });

  const result = await pool.query<{ data: Record<string, unknown>; current_step: number }>(
    `UPDATE onboarding_states
     SET data = jsonb_set(
           COALESCE(data, '{}'::jsonb),
           '{habitConfigs}',
           COALESCE(data->'habitConfigs', '{}'::jsonb) || $2::jsonb
         ),
         updated_at = now()
     WHERE anon_id = $1
     RETURNING data, current_step`,
    [ctx.anon_id, mergePayload],
  );
  const row = result.rows[0];
  return ok({
    data: row?.data,
    current_step: row?.current_step ?? row0?.current_step ?? 0,
    habit: { name: matchKey, ...merged },
  });
}
