import type { ParsedHabit } from '@gg/shared/types';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Hard cap on parsed habits — guards against runaway LLM output.
const MAX_HABITS = 50;

// Canonical set downstream cadence/label logic switches on.
const ALLOWED_FREQUENCIES = new Set(['daily', 'weekdays', 'weekends', 'weekly', '3x/week']);

// strict:false tool drift sometimes emits day indices as strings.
function toDayIndex(d: unknown): number | null {
  const n = typeof d === 'string' && /^-?\d+$/.test(d.trim()) ? Number(d) : d;
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= 6 ? n : null;
}

// Trust boundary for LLM tool output.
export function normalizeParsedHabits(raw: unknown): ParsedHabit[] {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as { habits?: unknown }).habits)) {
    return [];
  }
  const out: ParsedHabit[] = [];
  for (const item of (raw as { habits: unknown[] }).habits) {
    if (!item || typeof item !== 'object') continue;
    const h = item as { name?: unknown; frequency?: unknown; days?: unknown; time?: unknown };
    const name = typeof h.name === 'string' ? h.name.trim().slice(0, 100) : '';
    if (!name) continue;

    const freq = typeof h.frequency === 'string' ? h.frequency.trim() : '';
    const habit: ParsedHabit = {
      name,
      frequency: ALLOWED_FREQUENCIES.has(freq) ? freq : 'daily',
    };

    if (Array.isArray(h.days)) {
      const days = [...new Set(h.days.map(toDayIndex).filter((d): d is number => d !== null))].sort(
        (a, b) => a - b,
      );
      if (days.length > 0) habit.days = days;
    }
    if (typeof h.time === 'string' && TIME_RE.test(h.time)) habit.time = h.time;

    out.push(habit);
    if (out.length >= MAX_HABITS) break;
  }
  return out;
}
