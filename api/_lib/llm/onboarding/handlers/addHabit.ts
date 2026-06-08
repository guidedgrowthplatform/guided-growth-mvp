import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { inferSchedule, SCHEDULE_DAYS, type ScheduleOption } from '../../tools.onboarding.js';
import { MAX_HABITS, SCHEDULE_OPTIONS } from '../schemas.js';
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

const NAME_MAX_LEN = 100;
const DEFAULT_TIME = '09:00';

function isScheduleOption(v: string): boolean {
  return (SCHEDULE_OPTIONS as readonly string[]).includes(v);
}

export async function addHabit(
  ctx: OnboardingHandlerCtx,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const name = getString(args, 'name');
  if (name === undefined || name.length === 0) return invalid('name is required');
  if (name.length > NAME_MAX_LEN) {
    return invalid(`name must be at most ${NAME_MAX_LEN} characters`);
  }

  // name-only parity with Vapi: every other field is optional and defaulted.
  const daysRaw = getNumberArray(args, 'days');
  const daysValid =
    daysRaw !== undefined &&
    daysRaw.length > 0 &&
    daysRaw.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);

  const scheduleRaw = getString(args, 'schedule');
  const scheduleProvided = scheduleRaw !== undefined && isScheduleOption(scheduleRaw);

  // days authoritative; reconcile schedule from days, else expand preset, else Weekday.
  let days: number[];
  let schedule: ScheduleOption;
  if (daysValid) {
    days = Array.from(new Set(daysRaw as number[])).sort((a, b) => a - b);
    schedule =
      inferSchedule(days) ?? (scheduleProvided ? (scheduleRaw as ScheduleOption) : 'Weekday');
  } else if (scheduleProvided) {
    schedule = scheduleRaw as ScheduleOption;
    days = [...SCHEDULE_DAYS[schedule]];
  } else {
    schedule = 'Weekday';
    days = [...SCHEDULE_DAYS.Weekday];
  }

  const timeRaw = getString(args, 'time');
  const time = timeRaw !== undefined && TIME_REGEX.test(timeRaw) ? timeRaw : DEFAULT_TIME;

  const reminder = getBoolean(args, 'reminder') ?? true;

  const habitEntry = { days, time, reminder, schedule };
  const insertPayload = JSON.stringify({ habitConfigs: { [name]: habitEntry } });
  const updatePayload = JSON.stringify({ [name]: habitEntry });
  const nameLower = name.toLowerCase();

  // Advisory lock so read+cap-check+write is atomic — concurrent calls can't
  // both pass the MAX_HABITS gate. pool is max:1; pool.query can't span a txn.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [ctx.anon_id]);

    const existingRes = await client.query<{ hc: Record<string, unknown> | null }>(
      `SELECT data->'habitConfigs' AS hc FROM onboarding_states WHERE anon_id = $1`,
      [ctx.anon_id],
    );
    const existing = (existingRes.rows[0]?.hc ?? {}) as Record<string, unknown>;
    const isEdit = Object.keys(existing).some((k) => k.toLowerCase() === nameLower);
    if (!isEdit && Object.keys(existing).length >= MAX_HABITS) {
      await client.query('ROLLBACK');
      return handlerError('max_habits_reached');
    }

    const result = await client.query<{ data: Record<string, unknown>; current_step: number }>(
      `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
       VALUES ($1, 5, 'in_progress', $2::jsonb, now())
       ON CONFLICT (anon_id) DO UPDATE SET
         current_step = GREATEST(onboarding_states.current_step, 5),
         status = 'in_progress',
         data = jsonb_set(
           COALESCE(onboarding_states.data, '{}'::jsonb),
           '{habitConfigs}',
           COALESCE(onboarding_states.data->'habitConfigs', '{}'::jsonb) || $3::jsonb
         ),
         updated_at = now()
       RETURNING data, current_step`,
      [ctx.anon_id, insertPayload, updatePayload],
    );
    await client.query('COMMIT');

    const row = result.rows[0];
    return ok({
      data: row?.data ?? { habitConfigs: { [name]: habitEntry } },
      current_step: row?.current_step ?? 5,
      habit: { name, ...habitEntry },
    });
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // rollback best-effort
    }
    throw err;
  } finally {
    client.release();
  }
}
