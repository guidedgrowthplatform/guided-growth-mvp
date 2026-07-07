/**
 * submit_reflection_config handler — writes the user's evening reflection
 * schedule to onboarding_states.data.reflectionConfig.
 *
 * Auth model: see submitProfile.ts. Channel auth is X-Vapi-Secret;
 * identity arrives as `anon_id` injected by Vapi from static call params.
 *
 * Validation patterns mirror add_habit for time/days/schedule.
 *
 * B58 scope note: see the same note in ./submitMorningCheckin.ts. The
 * sibling onboarding-lane handler's server-side refusal/grounding guard is
 * not ported here because the Vapi webhook payload never carries the raw
 * user turn text this guard needs.
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

export async function submitReflectionConfig(
  args: Record<string, unknown>,
  db: Queryable = pool,
): Promise<HandlerResult> {
  console.log(
    '[vapi/tool] received name=submit_reflection_config anon_id=' + getString(args, 'anon_id'),
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

  // Reconcile: days is authoritative, schedule is a UI hint kept in sync so
  // PlanReviewPage's formatCadence(days) is faithful. If days doesn't match a
  // preset (custom combination), fall back to the LLM-supplied label.
  const schedule: ScheduleOption = inferSchedule(days) ?? (scheduleRaw as ScheduleOption);

  const modeRaw = getString(args, 'mode');
  const reflectionMode =
    modeRaw === 'freeform' ? 'freeform' : modeRaw === 'prompts' ? 'prompts' : undefined;

  const reflectionConfig = { time, days, reminder, schedule };
  const payload = JSON.stringify(
    reflectionMode ? { reflectionConfig, reflectionMode } : { reflectionConfig },
  );

  // DATA ONLY — current_step not touched on UPDATE; navigate_next handles
  // the screen advance. INSERT path defaults to step 6 (reflection).
  const result = await db.query(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
     VALUES ($1, 6, 'in_progress', $2::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       status = 'in_progress',
       data = onboarding_states.data || $2::jsonb,
       updated_at = now()`,
    [anonId, payload],
  );

  console.log(`[vapi/tool] submit_reflection_config written rows=${result.rowCount ?? 0}`);
  return { result: 'ok' };
}
