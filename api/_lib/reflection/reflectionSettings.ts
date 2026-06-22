import {
  DEFAULT_REFLECTION_PROMPTS,
  type ReflectionMode,
  type ReflectionSettings,
} from '@gg/shared/types';
import pool from '../db.js';

// Mirrors submit_custom_prompts limits.
const MAX_PROMPTS = 10;
const MAX_PROMPT_LEN = 280;
const TIME_REGEX = /^\d{1,2}:\d{2}$/;
const SCHEDULE_LABELS = ['Weekday', 'Weekend', 'Every day'];

type Queryable = { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> };

interface SettingsRow {
  mode: ReflectionMode;
  prompts: unknown;
  reminder_time: string | null;
  schedule_days: unknown;
  reminder_enabled: boolean;
  schedule_label: string | null;
}

export const DEFAULT_REFLECTION_SETTINGS: ReflectionSettings = {
  mode: 'prompts',
  prompts: DEFAULT_REFLECTION_PROMPTS,
  time: null,
  days: [],
  reminder: true,
  schedule: null,
};

function mapRow(row: SettingsRow): ReflectionSettings {
  return {
    mode: row.mode === 'freeform' ? 'freeform' : 'prompts',
    prompts: Array.isArray(row.prompts) ? (row.prompts as string[]) : [],
    time: row.reminder_time ?? null,
    days: Array.isArray(row.schedule_days) ? (row.schedule_days as number[]) : [],
    reminder: Boolean(row.reminder_enabled),
    schedule: row.schedule_label ?? null,
  };
}

export function sanitizePrompts(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((p): p is string => typeof p === 'string')
    .map((p) => p.trim().slice(0, MAX_PROMPT_LEN))
    .filter((p) => p.length > 0)
    .slice(0, MAX_PROMPTS);
}

export function sanitizeDays(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  return Array.from(
    new Set(input.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)),
  );
}

export async function readReflectionSettings(anonId: string): Promise<ReflectionSettings> {
  const result = await pool.query(
    `SELECT mode, prompts, reminder_time, schedule_days, reminder_enabled, schedule_label
     FROM reflection_settings WHERE anon_id = $1`,
    [anonId],
  );
  if (result.rows.length === 0) return DEFAULT_REFLECTION_SETTINGS;
  return mapRow(result.rows[0] as SettingsRow);
}

export async function upsertReflectionSettings(
  anonId: string,
  settings: ReflectionSettings,
  executor: Queryable = pool,
): Promise<ReflectionSettings> {
  const result = await executor.query(
    `INSERT INTO reflection_settings
       (anon_id, mode, prompts, reminder_time, schedule_days, reminder_enabled, schedule_label, updated_at)
     VALUES ($1, $2, $3::jsonb, $4, $5::jsonb, $6, $7, now())
     ON CONFLICT (anon_id) DO UPDATE SET
       mode = EXCLUDED.mode,
       prompts = EXCLUDED.prompts,
       reminder_time = EXCLUDED.reminder_time,
       schedule_days = EXCLUDED.schedule_days,
       reminder_enabled = EXCLUDED.reminder_enabled,
       schedule_label = EXCLUDED.schedule_label,
       updated_at = now()
     RETURNING mode, prompts, reminder_time, schedule_days, reminder_enabled, schedule_label`,
    [
      anonId,
      settings.mode,
      JSON.stringify(settings.prompts),
      settings.time,
      JSON.stringify(settings.days),
      settings.reminder,
      settings.schedule,
    ],
  );
  return mapRow(result.rows[0] as SettingsRow);
}

// Merge a partial update from the client onto a base (existing or defaults),
// validating each field. Returns the full settings to persist, or an error.
export function validateReflectionUpdate(
  body: unknown,
  base: ReflectionSettings,
): { ok: true; value: ReflectionSettings } | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Body must be an object' };
  }
  const b = body as Record<string, unknown>;
  const next: ReflectionSettings = { ...base };

  if (b.mode !== undefined) {
    if (b.mode !== 'prompts' && b.mode !== 'freeform') {
      return { ok: false, error: "mode must be 'prompts' or 'freeform'" };
    }
    next.mode = b.mode;
  }
  if (b.prompts !== undefined) {
    if (!Array.isArray(b.prompts)) return { ok: false, error: 'prompts must be an array' };
    next.prompts = sanitizePrompts(b.prompts);
  }
  if (b.time !== undefined) {
    if (b.time === null) next.time = null;
    else if (typeof b.time === 'string' && TIME_REGEX.test(b.time)) next.time = b.time;
    else return { ok: false, error: 'time must be HH:MM or null' };
  }
  if (b.days !== undefined) {
    if (!Array.isArray(b.days)) return { ok: false, error: 'days must be an array' };
    next.days = sanitizeDays(b.days);
  }
  if (b.reminder !== undefined) {
    if (typeof b.reminder !== 'boolean') return { ok: false, error: 'reminder must be a boolean' };
    next.reminder = b.reminder;
  }
  if (b.schedule !== undefined) {
    if (b.schedule === null) next.schedule = null;
    else if (typeof b.schedule === 'string' && SCHEDULE_LABELS.includes(b.schedule))
      next.schedule = b.schedule;
    else
      return { ok: false, error: `schedule must be one of ${SCHEDULE_LABELS.join(', ')} or null` };
  }

  if (next.mode === 'prompts' && next.prompts.length === 0) {
    next.prompts = DEFAULT_REFLECTION_PROMPTS;
  }
  // Freeform has no prompts — don't leave a stale list that resurfaces on switch-back.
  if (next.mode === 'freeform') {
    next.prompts = [];
  }
  return { ok: true, value: next };
}
