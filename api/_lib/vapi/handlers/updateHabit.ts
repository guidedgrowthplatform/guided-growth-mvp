/**
 * update_habit handler — partial-patch an existing habit in
 * onboarding_states.data.habitConfigs, PRESERVING fields the user didn't
 * change (unlike add_habit, which fills defaults for omitted fields).
 *
 * Auth model: see submitProfile.ts. Channel auth is X-Vapi-Secret;
 * identity arrives as `anon_id` injected by Vapi from static call params.
 *
 * Idempotent on miss: advanced flow holds habits in nav state until
 * completion, so a not-yet-persisted habit returns ok (no write) rather than
 * an error — the client voice-action drives the edit-habit nav in that case.
 */
import pool from '../../db.js';
import {
  inferSchedule,
  SCHEDULE_DAYS,
  SCHEDULE_OPTIONS,
  type ScheduleOption,
} from '../../llm/tools.onboarding.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/;
const NAME_MAX_LEN = 100;

export type HandlerResult = { result: string } | { error: string };
type HabitEntry = { days?: number[]; time?: string; reminder?: boolean; schedule?: string };

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

// GPT-family drift: array-of-number sometimes returns array-of-string items.
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

export async function updateHabit(args: Record<string, unknown>): Promise<HandlerResult> {
  console.log('[vapi/tool] received name=update_habit anon_id=' + getString(args, 'anon_id'));

  const anonId = getString(args, 'anon_id');
  if (!anonId || !UUID_REGEX.test(anonId)) {
    console.log('[vapi/tool] validation_failed reason=invalid_identity name=update_habit');
    return { error: 'invalid_identity' };
  }

  const nameRaw = getString(args, 'name');
  if (nameRaw === undefined || nameRaw.trim().length === 0) {
    console.log('[vapi/tool] validation_failed reason=name_required name=update_habit');
    return { error: 'validation_failed: name is required' };
  }
  if (nameRaw.length > NAME_MAX_LEN) {
    console.log('[vapi/tool] validation_failed reason=name_too_long name=update_habit');
    return { error: `validation_failed: name must be at most ${NAME_MAX_LEN} characters` };
  }
  const target = nameRaw.trim().toLowerCase();

  const existingRes = await pool.query<{ hc: Record<string, HabitEntry> | null }>(
    `SELECT data->'habitConfigs' AS hc FROM onboarding_states WHERE anon_id = $1`,
    [anonId],
  );
  const hc = existingRes.rows[0]?.hc;
  if (!hc || typeof hc !== 'object') {
    console.log('[vapi/tool] update_habit noop reason=no_habits');
    return { result: 'ok' };
  }
  const matchKey = Object.keys(hc).find((k) => k.toLowerCase() === target);
  if (!matchKey) {
    console.log('[vapi/tool] update_habit noop reason=key_not_found');
    return { result: 'ok' };
  }
  const existing = hc[matchKey] ?? {};

  const patch: HabitEntry = {};

  const daysRaw = getNumberArray(args, 'days');
  if (daysRaw !== undefined) {
    for (const d of daysRaw) {
      if (!Number.isInteger(d) || d < 0 || d > 6) {
        console.log('[vapi/tool] validation_failed reason=bad_days name=update_habit');
        return { error: 'validation_failed: each day must be an integer 0-6' };
      }
    }
    const days = Array.from(new Set(daysRaw)).sort((a, b) => a - b);
    patch.days = days;
    // Days authoritative — keep schedule label in sync (mirrors addHabit).
    patch.schedule = inferSchedule(days) ?? existing.schedule ?? 'Weekday';
  }

  const timeRaw = getString(args, 'time');
  if (timeRaw !== undefined) {
    if (!TIME_REGEX.test(timeRaw)) {
      console.log('[vapi/tool] validation_failed reason=bad_time name=update_habit');
      return { error: 'validation_failed: time must be HH:MM in 24-hour format' };
    }
    patch.time = timeRaw;
  }

  const reminderRaw = getBoolean(args, 'reminder');
  if (reminderRaw !== undefined) patch.reminder = reminderRaw;

  const scheduleRaw = getString(args, 'schedule');
  if (scheduleRaw !== undefined && patch.days === undefined) {
    if (!isScheduleOption(scheduleRaw)) {
      console.log('[vapi/tool] validation_failed reason=bad_schedule name=update_habit');
      return { error: `validation_failed: schedule must be one of ${SCHEDULE_OPTIONS.join(', ')}` };
    }
    patch.schedule = scheduleRaw as ScheduleOption;
    patch.days = [...SCHEDULE_DAYS[scheduleRaw as ScheduleOption]];
  }

  if (Object.keys(patch).length === 0) {
    console.log('[vapi/tool] validation_failed reason=no_fields name=update_habit');
    return { error: 'validation_failed: provide at least one field to update' };
  }

  const merged = { ...existing, ...patch };
  const mergePayload = JSON.stringify({ [matchKey]: merged });

  const result = await pool.query(
    `UPDATE onboarding_states
     SET data = jsonb_set(
           COALESCE(data, '{}'::jsonb),
           '{habitConfigs}',
           COALESCE(data->'habitConfigs', '{}'::jsonb) || $2::jsonb
         ),
         updated_at = now()
     WHERE anon_id = $1`,
    [anonId, mergePayload],
  );

  console.log(`[vapi/tool] update_habit written rows=${result.rowCount ?? 0}`);
  return { result: 'ok' };
}
