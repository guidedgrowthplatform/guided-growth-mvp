import pool from '../../../db.js';
import type { ToolResult } from '../../tools.js';
import { invalid, notFound } from '../../toolArgs.js';
import { FREQUENCY_OPTIONS } from '../schemas.js';

export {
  ok,
  invalid,
  notFound,
  handlerError,
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
};

export async function checkDedup(ctx: CheckinHandlerCtx): Promise<ToolResult | null> {
  if (!ctx.dedupLookup || !ctx.tool_call_id) return null;
  return ctx.dedupLookup(ctx.tool_call_id);
}

// Local-time dates; toISOString() would save the wrong day east of UTC.
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

function formatLocalDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayStr(): string {
  return formatLocalDate(new Date());
}

// "today"/"yesterday"/weekday/YYYY-MM-DD → local YYYY-MM-DD (most recent incl. today).
export function parseDateParam(dateStr: unknown): string {
  if (!dateStr || dateStr === 'today') return todayStr();
  if (dateStr === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return formatLocalDate(d);
  }
  const lower = String(dateStr).toLowerCase();
  const dayIndex = DAY_NAMES[lower] ?? -1;
  if (dayIndex !== -1) {
    const now = new Date();
    let diff = now.getDay() - dayIndex;
    if (diff < 0) diff += 7;
    const target = new Date(now);
    target.setDate(target.getDate() - diff);
    return formatLocalDate(target);
  }
  return String(dateStr);
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
}

export async function findHabitByName(anonId: string, name: string): Promise<HabitRow | null> {
  const res = await pool.query<HabitRow>(
    `SELECT id, name, cadence, schedule_days
       FROM user_habits
      WHERE anon_id = $1 AND name ILIKE $2 AND is_active = true AND archived_at IS NULL
      LIMIT 1`,
    [anonId, name],
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
