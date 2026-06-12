import type { ParsedHabit } from '@gg/shared/types';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// Trust boundary for LLM tool output. No count cap — advanced path returns all habits.
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

    const habit: ParsedHabit = {
      name,
      frequency:
        typeof h.frequency === 'string' && h.frequency.trim() ? h.frequency.trim() : 'daily',
    };

    if (Array.isArray(h.days)) {
      const days = [
        ...new Set(h.days.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6)),
      ].sort((a, b) => a - b);
      if (days.length > 0) habit.days = days;
    }
    if (typeof h.time === 'string' && TIME_RE.test(h.time)) habit.time = h.time;

    out.push(habit);
  }
  return out;
}
