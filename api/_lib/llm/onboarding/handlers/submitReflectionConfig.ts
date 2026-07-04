import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { inferSchedule, type ScheduleOption } from '../../tools.onboarding.js';
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

function isScheduleOption(v: string): boolean {
  return (SCHEDULE_OPTIONS as readonly string[]).includes(v);
}

export async function submitReflectionConfig(
  ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
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

  // Reconcile: days is authoritative, schedule kept in sync so a stale label
  // from LLM drift lands corrected. Falls back to the LLM-supplied label when
  // days is a custom combination.
  const schedule: ScheduleOption = inferSchedule(days) ?? (scheduleRaw as ScheduleOption);

  const modeRaw = getString(args, 'mode');
  const reflectionMode =
    modeRaw === 'freeform' ? 'freeform' : modeRaw === 'prompts' ? 'prompts' : undefined;

  const reflectionConfig = { time, days, reminder, schedule };
  const payload = JSON.stringify(
    reflectionMode ? { reflectionConfig, reflectionMode } : { reflectionConfig },
  );

  // GREATEST-bump to the reflection beat's V3 persist step (8) — same semantics
  // as the tap save, so a voice save survives refresh identically. Later edits
  // from the app (reflection settings) re-call this; GREATEST never rewinds.
  const result = await pool.query<{ data: Record<string, unknown>; current_step: number }>(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
     VALUES ($1, 8, 'in_progress', $2::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       current_step = GREATEST(onboarding_states.current_step, 8),
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       updated_at = now()
     RETURNING data, current_step`,
    [ctx.anon_id, payload],
  );

  const row = result.rows[0];
  return ok({
    data: row?.data ?? { reflectionConfig },
    current_step: row?.current_step ?? 8,
    reflectionConfig,
  });
}
