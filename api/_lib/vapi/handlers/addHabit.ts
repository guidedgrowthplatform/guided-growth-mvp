/**
 * add_habit handler — adds or edits a habit in
 * onboarding_states.data.habitConfigs.
 *
 * Auth model: see submitProfile.ts. Channel auth is X-Vapi-Secret;
 * identity arrives as `anon_id` injected by Vapi from static call params.
 *
 * Edit pattern: if `name` already exists in habitConfigs, this is an UPDATE
 * (allowed regardless of MAX_HABITS). Otherwise it's a new add and is
 * rejected when at MAX_HABITS.
 *
 * Storage shape mirrors api/onboarding/[...path].ts complete flow which
 * reads habitConfigs[name] = { days, time, reminder } and inserts into
 * user_habits on completion.
 */
import pool from '../../db.js';
import {
  inferSchedule,
  MAX_HABITS,
  SCHEDULE_DAYS,
  SCHEDULE_OPTIONS,
  type ScheduleOption,
} from '../../llm/tools.onboarding.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/;
const NAME_MAX_LEN = 100;
const DEFAULT_TIME = '09:00';

export type HandlerResult = { result: string } | { error: string };

function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

// GPT-family drift: booleans sometimes arrive as the strings "true"/"false".
// Accept both, reject anything else (don't coerce truthy non-bool values).
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
// items ("1" instead of 1). Coerce per-item; reject if any item can't be
// turned into a finite integer.
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

export async function addHabit(args: Record<string, unknown>): Promise<HandlerResult> {
  console.log('[vapi/tool] received name=add_habit anon_id=' + getString(args, 'anon_id'));

  const anonId = getString(args, 'anon_id');
  if (!anonId || !UUID_REGEX.test(anonId)) {
    console.log('[vapi/tool] validation_failed reason=invalid_identity');
    return { error: 'invalid_identity' };
  }

  const name = getString(args, 'name');
  if (name === undefined || name.length === 0) {
    console.log('[vapi/tool] validation_failed reason=name_required');
    return { error: 'validation_failed: name is required' };
  }
  if (name.length > NAME_MAX_LEN) {
    console.log('[vapi/tool] validation_failed reason=name_too_long');
    return { error: `validation_failed: name must be at most ${NAME_MAX_LEN} characters` };
  }

  // days/time/reminder/schedule are OPTIONAL. The tool contract promises the
  // server fills sensible, internally-consistent defaults when the user only
  // names a habit (the common case on the selection screen). A provided value
  // is used; a missing OR malformed one falls back to a default so a habit is
  // never lost over a formatting slip. Defaults mirror the tool description:
  // Weekday schedule, weekday days, 09:00, reminder on.
  const scheduleRaw = getString(args, 'schedule');
  const scheduleProvided = scheduleRaw !== undefined && isScheduleOption(scheduleRaw);

  const daysRaw = getNumberArray(args, 'days');
  const daysValid =
    daysRaw !== undefined &&
    daysRaw.length > 0 &&
    daysRaw.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);

  // Resolve days + schedule together so they always agree. Days is the
  // authoritative field — when both are given, we re-infer the schedule label
  // from days so the persisted shape never carries a stale chip ({days:[1,3,5]
  // + schedule:'Weekday'} from LLM drift becomes {days:[1,3,5] +
  // schedule:'Weekday'} only when inferSchedule can't match a preset; else it
  // matches reality). PlanReviewPage's formatCadence(days) is then faithful.
  //  - both given    -> trust days, overwrite schedule via inferSchedule
  //  - days only     -> infer the matching preset (else label it Weekday)
  //  - schedule only -> expand the preset into its day set
  //  - neither       -> Weekday preset
  let days: number[];
  let schedule: ScheduleOption;
  if (daysValid) {
    days = Array.from(new Set(daysRaw as number[])).sort((a, b) => a - b);
    const inferred = inferSchedule(days);
    schedule = inferred ?? (scheduleProvided ? (scheduleRaw as ScheduleOption) : 'Weekday');
  } else if (scheduleProvided) {
    schedule = scheduleRaw as ScheduleOption;
    days = [...SCHEDULE_DAYS[schedule]];
  } else {
    schedule = 'Weekday';
    days = [...SCHEDULE_DAYS.Weekday];
  }

  const timeRaw = getString(args, 'time');
  const time = timeRaw !== undefined && TIME_REGEX.test(timeRaw) ? timeRaw : DEFAULT_TIME;

  const reminderRaw = getBoolean(args, 'reminder');
  const reminder = reminderRaw ?? true;

  // Polarity: staged when the model provides it. The schedule call (2nd of the
  // two-call pattern) omits it; the SET below deep-merges per-name so a prior
  // call's habitType survives instead of being wiped.
  const habitTypeRaw = getString(args, 'habit_type');
  const habitType =
    habitTypeRaw === 'binary_avoid' || habitTypeRaw === 'binary_do' ? habitTypeRaw : undefined;

  const habitEntry = habitType
    ? { days, time, reminder, schedule, habitType }
    : { days, time, reminder, schedule };

  // Atomic MAX_HABITS enforcement. INSERT path always allows (new row → 1
  // habit, well under MAX). UPDATE path is gated by a WHERE clause that
  // accepts only when current count < MAX or the name is already present
  // (edit mode). Empty RETURNING signals the gate blocked the write —
  // distinguishes the max-reached case without a separate read.
  //
  // Previous shape did a separate SELECT then INSERT, leaving a TOCTOU
  // window where two parallel calls could both pass the count check.
  const insertPayload = JSON.stringify({ habitConfigs: { [name]: habitEntry } });
  const updatePayload = JSON.stringify({ [name]: habitEntry });

  // DATA ONLY — current_step not touched on UPDATE; navigate_next handles
  // the screen advance. INSERT path defaults to step 5 (habits). The
  // atomic MAX_HABITS gate stays — it's enforced via the WHERE clause on
  // the UPDATE branch.
  const result = await pool.query(
    `INSERT INTO onboarding_states (anon_id, current_step, status, data, updated_at)
     VALUES ($1, 5, 'in_progress', $2::jsonb, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       status = 'in_progress',
       data = jsonb_set(
         COALESCE(onboarding_states.data, '{}'::jsonb),
         '{habitConfigs}',
         COALESCE(onboarding_states.data->'habitConfigs', '{}'::jsonb)
           || jsonb_build_object(
                $4::text,
                COALESCE(onboarding_states.data->'habitConfigs'->$4, '{}'::jsonb) || ($3::jsonb -> $4)
              )
       ),
       updated_at = now()
     WHERE
       jsonb_typeof(COALESCE(onboarding_states.data->'habitConfigs', '{}'::jsonb)) = 'object'
       AND (
         (SELECT count(*) FROM jsonb_object_keys(
           COALESCE(onboarding_states.data->'habitConfigs', '{}'::jsonb)
         )) < $5
         OR (COALESCE(onboarding_states.data->'habitConfigs', '{}'::jsonb)) ? $4::text
       )
     RETURNING anon_id`,
    [anonId, insertPayload, updatePayload, name, MAX_HABITS],
  );

  if ((result.rowCount ?? 0) === 0) {
    console.log('[vapi/tool] validation_failed reason=max_habits_reached');
    return { error: 'max_habits_reached' };
  }

  console.log(`[vapi/tool] add_habit written rows=${result.rowCount ?? 0}`);
  return { result: 'ok' };
}
