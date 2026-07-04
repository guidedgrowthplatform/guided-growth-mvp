/**
 * weekly_add_habit handler — the add-one-small-thing move during The Weekly.
 * Only meant to fire when the week went well and a state area is low; the
 * system prompt (globalContext.ts) enforces "one at most", this handler
 * enforces NO max-habit cap (unlike onboarding's add_habit, which is capped
 * at MAX_HABITS — The Weekly runs against a user's live, already-onboarded
 * plan, which has no such ceiling).
 *
 * Writes to the LIVE relational user_habits table (the check-in model), not
 * onboarding_states.data.habitConfigs. Logic ported from
 * api/_lib/llm/checkin/handlers/createHabit.ts, adapted to the Vapi handler
 * shape (anon_id injected via args, no dedup ledger — Vapi's own
 * vapi_tool_calls idempotency ledger covers replay safety at the webhook
 * layer).
 *
 * Auth model: see ../../vapi/handlers/submitProfile.ts. Channel auth is
 * X-Vapi-Secret; identity arrives as `anon_id` injected by Vapi from static
 * call params.
 */
import pool, { type Queryable } from '../../db.js';
import {
  FREQUENCY_OPTIONS,
  HABIT_NAME_MAX_LEN,
  type FrequencyOption,
  type HabitTypeOption,
} from '../../llm/tools.weekly.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HandlerResult = { result: string } | { error: string };

function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

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

// Same cadence mapping as api/_lib/llm/checkin/handlers/shared.ts
// cadenceFromFrequency.
function cadenceFromFrequency(frequency: FrequencyOption | undefined): string {
  switch (frequency) {
    case '3x/week':
      return '3_specific_days';
    case 'weekly':
      return 'once_a_week';
    case 'weekdays':
      return 'weekdays';
    case 'daily':
    default:
      return 'daily';
  }
}

export async function weeklyAddHabit(
  args: Record<string, unknown>,
  db: Queryable = pool,
): Promise<HandlerResult> {
  console.log('[vapi/tool] received name=weekly_add_habit anon_id=' + getString(args, 'anon_id'));

  const anonId = getString(args, 'anon_id');
  if (!anonId || !UUID_REGEX.test(anonId)) {
    console.log('[vapi/tool] validation_failed reason=invalid_identity');
    return { error: 'invalid_identity' };
  }

  const name = getString(args, 'name')?.trim();
  if (!name) {
    console.log('[vapi/tool] validation_failed reason=name_required');
    return { error: 'validation_failed: name is required' };
  }
  if (name.length > HABIT_NAME_MAX_LEN) {
    console.log('[vapi/tool] validation_failed reason=name_too_long');
    return { error: `validation_failed: name must be at most ${HABIT_NAME_MAX_LEN} characters` };
  }

  const frequencyRaw = getString(args, 'frequency');
  if (
    frequencyRaw !== undefined &&
    !(FREQUENCY_OPTIONS as readonly string[]).includes(frequencyRaw)
  ) {
    console.log('[vapi/tool] validation_failed reason=frequency_invalid');
    return {
      error: `validation_failed: frequency must be one of ${FREQUENCY_OPTIONS.join(', ')}`,
    };
  }
  const frequency = frequencyRaw as FrequencyOption | undefined;

  const scheduleDays = getNumberArray(args, 'schedule_days');
  if (scheduleDays !== undefined) {
    for (const d of scheduleDays) {
      if (!Number.isInteger(d) || d < 0 || d > 6) {
        console.log('[vapi/tool] validation_failed reason=schedule_days_invalid');
        return { error: 'validation_failed: schedule_days must be ints 0-6' };
      }
    }
  }

  const habitTypeRaw = getString(args, 'habit_type');
  const habitType: HabitTypeOption = habitTypeRaw === 'binary_avoid' ? 'binary_avoid' : 'binary_do';

  const existing = await db.query<{ name: string }>(
    `SELECT name FROM user_habits
      WHERE anon_id = $1 AND name ILIKE $2 AND is_active = true AND archived_at IS NULL
      LIMIT 1`,
    [anonId, name],
  );
  if (existing.rows[0]) {
    console.log('[vapi/tool] validation_failed reason=habit_already_exists');
    return { error: `invalid_args: You already have a habit called "${existing.rows[0].name}".` };
  }

  const cadence = cadenceFromFrequency(frequency);
  const result = await db.query(
    `INSERT INTO user_habits (anon_id, name, habit_type, cadence, schedule_days, is_active, sort_order)
     VALUES ($1, $2, $3, $4, $5::int[], true, 9999)
     RETURNING id`,
    [anonId, name, habitType, cadence, scheduleDays ?? null],
  );

  console.log(`[vapi/tool] weekly_add_habit written rows=${result.rowCount ?? 0}`);
  return { result: 'ok' };
}
