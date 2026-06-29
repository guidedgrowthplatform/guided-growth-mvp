/**
 * submit_morning_checkin handler — writes the user's morning check-in schedule
 * to onboarding_states.data.morningCheckin on ONBOARD-MORNING-SETUP.
 *
 * Auth model: see submitProfile.ts. Channel auth is X-Vapi-Secret;
 * identity arrives as `anon_id` injected by Vapi from static call params.
 *
 * Validation patterns mirror submitReflectionConfig (time/days/reminder/schedule).
 */
import pool, { type Queryable } from '../../db.js';
import {
  inferSchedule,
  SCHEDULE_OPTIONS,
  type ScheduleOption,
} from '../../llm/tools.onboarding.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/;

export type HandlerResult = { result: string } | { error: string };

function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

// GPT-family drift: booleans sometimes arrive as the strings "true"/"false".
function getBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const v = args[key];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return undefined;
}

// GPT-family drift: array-of-number schemas sometimes return array-of-string
// items. Coerce per-item; reject if any item can't be turned into an integer.
function getNumberArray(args: Record<string, unknown>, key: string): number[] | undefined {
  const v = args[key];
  if (!Array.isArray(v)) return undefined;
  const out: number[] = [];
  for (const item of v) {
    let n: number;
    if (typeof item === 'number') n = item;
    else if (typeof item === 'string' && /^-?\d+$/.test(item)) n = parseInt(item, 10);
    else return undefined;
    if (!Number.isFinite(n)) return undefined;
    out.push(n);
  }
  return out;
}

function isScheduleOption(v: string): boolean {
  return (SCHEDULE_OPTIONS as readonly string[]).includes(v);
}

export async function submitMorningCheckin(
  args: Record<string, unknown>,
  db: Queryable = pool,
): Promise<HandlerResult> {
  console.log(
    '[vapi/tool] received name=submit_morning_checkin anon_id=' + getString(args, 'anon_id'),
  );

  const anonId = getString(args, 'anon_id');
  if (!anonId || !UUID_REGEX.test(anonId)) {
    console.log('[vapi/tool] validation_failed reason=invalid_identity');
    return { error: 'invalid_identity' };
  }

  const time = getString(args, 'time');
  if (time === undefined || !TIME_REGEX.test(time)) {
    console.log('[vapi/tool] validation_failed reason=time_invalid');
    return { error: 'validation_failed: time must be HH:MM in 24-hour format' };
  }

  const daysRaw = getNumberArray(args, 'days');
  if (daysRaw === undefined) {
    console.log('[vapi/tool] validation_failed reason=days_not_number_array');
    return { error: 'validation_failed: days must be an array of integers 0-6' };
  }
  for (const d of daysRaw) {
    if (!Number.isInteger(d) || d < 0 || d > 6) {
      console.log('[vapi/tool] validation_failed reason=days_out_of_range');
      return { error: 'validation_failed: each day must be an integer 0-6' };
    }
  }
  const days = Array.from(new Set(daysRaw)).sort((a, b) => a - b);

  const reminder = getBoolean(args, 'reminder');
  if (reminder === undefined) {
    console.log('[vapi/tool] validation_failed reason=reminder_not_boolean');
    return { error: 'validation_failed: reminder must be a boolean' };
  }

  const scheduleRaw = getString(args, 'schedule');
  if (scheduleRaw === undefined || !isScheduleOption(scheduleRaw)) {
    console.log('[vapi/tool] validation_failed reason=schedule_not_in_enum');
    return { error: `validation_failed: schedule must be one of ${SCHEDULE_OPTIONS.join(', ')}` };
  }

  // Reconcile: days is authoritative, schedule kept in sync so a stale label from
  // LLM drift lands corrected. Falls back to the LLM-supplied label for a custom
  // day combination.
  const schedule: ScheduleOption = inferSchedule(days) ?? (scheduleRaw as ScheduleOption);

  const morningCheckin = { time, days, reminder, schedule };
  const payload = JSON.stringify({ morningCheckin });

  // DATA ONLY — current_step not touched on UPDATE; navigate_next handles the
  // screen advance. INSERT path defaults to step 7 (morning-checkin-setup); it is
  // a fallback only — by this beat a row already exists from prior steps.
  const result = await db.query(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
     VALUES ($1, 7, 'in_progress', $2::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       updated_at = now()`,
    [anonId, payload],
  );

  console.log(`[vapi/tool] submit_morning_checkin written rows=${result.rowCount ?? 0}`);
  return { result: 'ok' };
}
