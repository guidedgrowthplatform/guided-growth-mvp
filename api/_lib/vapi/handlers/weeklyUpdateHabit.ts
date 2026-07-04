/**
 * weekly_update_habit handler — edits an existing LIVE habit during The
 * Weekly (rename = shrink-it move, frequency/schedule_days = lower-the-
 * frequency move).
 *
 * Unlike onboarding's update_habit (which patches onboarding_states.data.
 * habitConfigs, the pre-live JSONB staging blob), The Weekly runs post-
 * onboarding against a user's LIVE habits — same relational user_habits
 * table the check-in Direct-LLM handlers use (api/_lib/llm/checkin/handlers/
 * updateHabit.ts). Logic ported from there, adapted to the Vapi handler
 * shape (anon_id injected via args, no CheckinHandlerCtx).
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
} from '../../llm/tools.weekly.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_REGEX = /^([01]?\d|2[0-3]):[0-5]\d$/;

export type HandlerResult = { result: string } | { error: string };

function getString(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

function getBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const v = args[key];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    if (v === 'true') return true;
    if (v === 'false') return false;
  }
  return undefined;
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

// Strip articles + trailing "habit(s)"/"please" so spoken names match stored
// (ILIKE). Mirrors api/_lib/llm/checkin/handlers/shared.ts normalizeVoiceName.
function normalizeVoiceName(raw: string): string {
  return raw
    .trim()
    .replace(/^(?:the|my|a|an)\s+/i, '')
    .replace(/\s+(?:please|thanks?|thank you)$/i, '')
    .replace(/\s+habits?$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Same cadence mapping as api/_lib/llm/checkin/handlers/shared.ts
// cadenceFromFrequency, so a Weekly-edited habit's cadence label matches the
// check-in surface's own writes exactly.
function cadenceFromFrequency(frequency: FrequencyOption | undefined): string | undefined {
  if (frequency === undefined) return undefined;
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

export async function weeklyUpdateHabit(
  args: Record<string, unknown>,
  db: Queryable = pool,
): Promise<HandlerResult> {
  console.log(
    '[vapi/tool] received name=weekly_update_habit anon_id=' + getString(args, 'anon_id'),
  );

  const anonId = getString(args, 'anon_id');
  if (!anonId || !UUID_REGEX.test(anonId)) {
    console.log('[vapi/tool] validation_failed reason=invalid_identity');
    return { error: 'invalid_identity' };
  }

  const rawName = getString(args, 'name');
  if (!rawName || rawName.trim().length === 0) {
    console.log('[vapi/tool] validation_failed reason=name_required');
    return { error: 'validation_failed: name is required' };
  }
  const name = normalizeVoiceName(rawName);

  const newNameRaw = getString(args, 'new_name');
  const newName = newNameRaw?.trim();
  if (newName !== undefined && newName.length > HABIT_NAME_MAX_LEN) {
    console.log('[vapi/tool] validation_failed reason=new_name_too_long');
    return {
      error: `validation_failed: new_name must be at most ${HABIT_NAME_MAX_LEN} characters`,
    };
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

  const timeRaw = getString(args, 'time');
  if (timeRaw !== undefined && !TIME_REGEX.test(timeRaw)) {
    console.log('[vapi/tool] validation_failed reason=time_invalid');
    return { error: 'validation_failed: time must be HH:MM 24-hour format' };
  }

  const reminder = getBoolean(args, 'reminder');

  if (
    newName === undefined &&
    frequency === undefined &&
    scheduleDays === undefined &&
    timeRaw === undefined &&
    reminder === undefined
  ) {
    console.log('[vapi/tool] validation_failed reason=no_fields_to_update');
    return { error: 'validation_failed: provide at least one field to update' };
  }

  const found = await db.query<{
    id: string;
    name: string;
  }>(
    `SELECT id, name FROM user_habits
      WHERE anon_id = $1 AND name ILIKE $2 AND is_active = true AND archived_at IS NULL
      LIMIT 1`,
    [anonId, name],
  );
  const habit = found.rows[0];
  if (!habit) {
    console.log('[vapi/tool] not_found reason=habit_not_found');
    return { error: `not_found: No habit called "${name}".` };
  }

  // Renaming onto another existing habit would violate UNIQUE (anon_id, name)
  // and abort the webhook's whole tool-call transaction; catch it up front and
  // hand the coach a speakable error instead.
  if (newName !== undefined && newName.toLowerCase() !== habit.name.toLowerCase()) {
    const clash = await db.query(
      `SELECT 1 FROM user_habits
        WHERE anon_id = $1 AND name ILIKE $2 AND id <> $3
          AND is_active = true AND archived_at IS NULL
        LIMIT 1`,
      [anonId, newName, habit.id],
    );
    if (clash.rows[0]) {
      console.log('[vapi/tool] validation_failed reason=new_name_taken');
      return { error: `validation_failed: There is already a habit called "${newName}".` };
    }
  }

  const cadence = cadenceFromFrequency(frequency);
  const result = await db.query(
    `UPDATE user_habits
        SET name = COALESCE($3, name),
            cadence = COALESCE($4, cadence),
            schedule_days = COALESCE($5::int[], schedule_days),
            reminder_time = COALESCE($6::time, reminder_time),
            reminder_enabled = COALESCE($7, reminder_enabled)
      WHERE id = $1 AND anon_id = $2
      RETURNING id`,
    [
      habit.id,
      anonId,
      newName ?? null,
      cadence ?? null,
      scheduleDays ?? null,
      timeRaw ?? null,
      reminder ?? null,
    ],
  );

  console.log(`[vapi/tool] weekly_update_habit written rows=${result.rowCount ?? 0}`);
  return { result: 'ok' };
}
