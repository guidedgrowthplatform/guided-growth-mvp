import pool from '../../../db.js';
import { validateDate } from '../../../validation.js';
import type { HabitType } from '@gg/shared/types';
import type { ToolResult } from '../../tools.js';
import { invalid, notFound } from '../../toolArgs.js';
import { FREQUENCY_OPTIONS } from '../schemas.js';

export {
  ok,
  invalid,
  notFound,
  getString,
  getNumber,
  getNumberArray,
  getStringArray,
} from '../../toolArgs.js';

// tool_call_id + dedupLookup guard non-idempotent writes against mid-turn replay.
export type CheckinHandlerCtx = {
  anon_id: string;
  tool_call_id?: string;
  dedupLookup?: (toolCallId: string) => Promise<ToolResult | null>;
  // Validated IANA tz from the request; date helpers resolve the user's local day.
  timezone?: string;
};

export async function checkDedup(ctx: CheckinHandlerCtx): Promise<ToolResult | null> {
  if (!ctx.dedupLookup || !ctx.tool_call_id) return null;
  return ctx.dedupLookup(ctx.tool_call_id);
}

// Weekday → index (0=Sunday), multilingual for spoken input.
const DAY_NAMES: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
  domingo: 0,
  lunes: 1,
  martes: 2,
  miércoles: 3,
  jueves: 4,
  viernes: 5,
  sábado: 6,
  minggu: 0,
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  sabtu: 6,
};

// en-CA yields YYYY-MM-DD; computing in tz avoids the server-UTC off-by-one.
function formatInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function todayStr(tz: string = 'UTC'): string {
  return formatInTz(new Date(), tz);
}

// "today"/"yesterday"/weekday/YYYY-MM-DD → tz-local YYYY-MM-DD; null if a literal date is unparseable.
export function parseDateParam(dateStr: unknown, tz: string = 'UTC'): string | null {
  if (!dateStr || dateStr === 'today') return todayStr(tz);
  // Calendar math on the tz-local triple treated as UTC, then formatted back.
  const minusDays = (days: number): string => {
    const [y, m, d] = todayStr(tz).split('-').map(Number);
    const base = new Date(Date.UTC(y, m - 1, d));
    base.setUTCDate(base.getUTCDate() - days);
    return formatInTz(base, 'UTC');
  };
  if (dateStr === 'yesterday') return minusDays(1);
  const lower = String(dateStr).toLowerCase();
  const dayIndex = DAY_NAMES[lower] ?? -1;
  if (dayIndex !== -1) {
    const [y, m, d] = todayStr(tz).split('-').map(Number);
    let diff = new Date(Date.UTC(y, m - 1, d)).getUTCDay() - dayIndex;
    if (diff < 0) diff += 7;
    return minusDays(diff);
  }
  return validateDate(dateStr);
}

// Strip articles + trailing "habit(s)"/"please" so spoken names match stored (ILIKE).
export function normalizeVoiceName(raw: string): string {
  return raw
    .trim()
    .replace(/^(?:the|my|a|an)\s+/i, '')
    .replace(/\s+(?:please|thanks?|thank you)$/i, '')
    .replace(/\s+habits?$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// --- Shared lookups + arg resolution (anon_id-scoped) --------------------

export interface HabitRow {
  id: string;
  name: string;
  cadence: string;
  schedule_days: number[] | null;
  habit_type: HabitType;
}

export async function findHabitByName(anonId: string, name: string): Promise<HabitRow | null> {
  const res = await pool.query<HabitRow>(
    `SELECT id, name, cadence, schedule_days, habit_type
       FROM user_habits
      WHERE anon_id = $1 AND name ILIKE $2 AND is_active = true AND archived_at IS NULL
      LIMIT 1`,
    [anonId, name],
  );
  return res.rows[0] ?? null;
}

export async function findHabitById(anonId: string, id: string): Promise<HabitRow | null> {
  const res = await pool.query<HabitRow>(
    `SELECT id, name, cadence, schedule_days, habit_type
       FROM user_habits
      WHERE anon_id = $1 AND id = $2 AND is_active = true AND archived_at IS NULL
      LIMIT 1`,
    [anonId, id],
  );
  return res.rows[0] ?? null;
}

export interface MetricRow {
  id: string;
  name: string;
  input_type: string;
}

export async function findMetricByName(anonId: string, name: string): Promise<MetricRow | null> {
  const res = await pool.query<MetricRow>(
    `SELECT id, name, input_type FROM metrics WHERE anon_id = $1 AND name ILIKE $2 LIMIT 1`,
    [anonId, name],
  );
  return res.rows[0] ?? null;
}

export type Resolved<T> = { ok: true; value: T } | { ok: false; error: ToolResult };

export async function resolveHabitArg(
  anonId: string,
  args: Record<string, unknown>,
): Promise<Resolved<HabitRow>> {
  // client taps key by id (names not unique); voice coach sends name.
  const rawId = args.habit_id;
  if (typeof rawId === 'string' && rawId.trim() !== '') {
    const habit = await findHabitById(anonId, rawId.trim());
    if (!habit) return { ok: false, error: notFound(`No habit with id "${rawId}".`) };
    return { ok: true, value: habit };
  }
  const raw = args.name;
  if (typeof raw !== 'string' || raw.trim() === '')
    return { ok: false, error: invalid('name is required') };
  const name = normalizeVoiceName(raw);
  const habit = await findHabitByName(anonId, name);
  if (!habit) return { ok: false, error: notFound(`No habit called "${name}".`) };
  return { ok: true, value: habit };
}

export async function resolveMetricArg(
  anonId: string,
  args: Record<string, unknown>,
): Promise<Resolved<MetricRow>> {
  const raw = args.name;
  if (typeof raw !== 'string' || raw.trim() === '')
    return { ok: false, error: invalid('name is required') };
  const name = normalizeVoiceName(raw);
  const metric = await findMetricByName(anonId, name);
  if (!metric) return { ok: false, error: notFound(`No metric called "${name}".`) };
  return { ok: true, value: metric };
}

export function validateFrequency(frequency: string | undefined): ToolResult | null {
  if (frequency !== undefined && !(FREQUENCY_OPTIONS as readonly string[]).includes(frequency)) {
    return invalid(`frequency must be one of ${FREQUENCY_OPTIONS.join(', ')}`);
  }
  return null;
}

// 7-slot week (0=Sunday) for the habit-suggestion card.
export function daysBoolFrom(cadence: string, scheduleDays: number[] | null): boolean[] {
  if (scheduleDays && scheduleDays.length > 0) {
    return Array.from({ length: 7 }, (_, i) => scheduleDays.includes(i));
  }
  if (cadence === 'weekdays') return [false, true, true, true, true, true, false];
  // daily / once_a_week / 3_specific_days without explicit days → show all on.
  return [true, true, true, true, true, true, true];
}

export function cadenceFromFrequency(frequency: string | undefined): string {
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

export const HABIT_SUGGESTIONS: readonly string[] = [
  'journaling',
  'stretching',
  'hydration tracking',
  'gratitude practice',
  'deep breathing',
  'walking',
  'meal prep',
  'digital detox',
  'cold shower',
  'reading',
  'yoga',
  'no phone before bed',
];

export const DEFAULT_SUGGESTION = 'mindful breaks';
