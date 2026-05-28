import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
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

  const daysRaw = getNumberArray(args, 'days');
  if (daysRaw === undefined) return invalid('days must be an array of integers 0-6');
  for (const d of daysRaw) {
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      return invalid('each day must be an integer 0-6');
    }
  }
  const days = Array.from(new Set(daysRaw)).sort((a, b) => a - b);

  const time = getString(args, 'time');
  if (time === undefined || !TIME_REGEX.test(time)) {
    return invalid('time must be HH:MM in 24-hour format');
  }

  const reminder = getBoolean(args, 'reminder');
  if (reminder === undefined) return invalid('reminder must be a boolean');

  const schedule = getString(args, 'schedule');
  if (schedule === undefined || !isScheduleOption(schedule)) {
    return invalid(`schedule must be one of ${SCHEDULE_OPTIONS.join(', ')}`);
  }

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
