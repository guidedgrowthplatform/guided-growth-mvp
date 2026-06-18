import { describe, it, expect } from 'vitest';
import { CHECKIN_SCRIPTS, pickVariation, type CheckinStageKey } from '../scriptLibrary';

const ALL_KEYS: CheckinStageKey[] = [
  'morning_greeting',
  'morning_state_prompt',
  'morning_wrap',
  'evening_greeting_habits',
  'evening_habit_prompt',
  'reflection_transition',
  'reflection_proud',
  'reflection_forgive',
  'reflection_grateful',
  'evening_wrap',
  'are_you_done',
  'acknowledgment',
];

function datesFrom(start: string, count: number): string[] {
  const out: string[] = [];
  const base = new Date(`${start}T00:00:00Z`);
  for (let i = 0; i < count; i++) {
    const d = new Date(base.getTime() + i * 86_400_000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

describe('CHECKIN_SCRIPTS', () => {
  it('every stage key has a non-empty array', () => {
    for (const key of ALL_KEYS) {
      expect(Array.isArray(CHECKIN_SCRIPTS[key])).toBe(true);
      expect(CHECKIN_SCRIPTS[key].length).toBeGreaterThan(0);
    }
  });

  it('has no extra or missing keys', () => {
    expect(Object.keys(CHECKIN_SCRIPTS).sort()).toEqual([...ALL_KEYS].sort());
  });
});

describe('pickVariation', () => {
  it('is deterministic for a given (stage, daySeed)', () => {
    for (const key of ALL_KEYS) {
      const first = pickVariation(key, '2026-06-18');
      for (let i = 0; i < 100; i++) {
        expect(pickVariation(key, '2026-06-18')).toBe(first);
      }
    }
  });

  it('returns a member of the stage array', () => {
    const dates = datesFrom('2026-06-01', 30);
    for (const key of ALL_KEYS) {
      for (const day of dates) {
        expect(CHECKIN_SCRIPTS[key]).toContain(pickVariation(key, day));
      }
    }
  });

  it('varies across daySeed values for multi-variation stages', () => {
    const dates = datesFrom('2026-06-01', 14);
    const multiStages = ALL_KEYS.filter((k) => CHECKIN_SCRIPTS[k].length > 1);
    for (const key of multiStages) {
      const picks = new Set(dates.map((day) => pickVariation(key, day)));
      expect(picks.size).toBeGreaterThanOrEqual(2);
    }
  });

  it('always returns the single fixed line for reflection prompts', () => {
    const dates = datesFrom('2026-06-01', 30);
    const fixed: Record<string, string> = {
      reflection_proud: 'What are you proud of today?',
      reflection_forgive: 'What do you forgive yourself for today?',
      reflection_grateful: 'What are you grateful for today?',
    };
    for (const [key, line] of Object.entries(fixed)) {
      for (const day of dates) {
        expect(pickVariation(key as CheckinStageKey, day)).toBe(line);
      }
    }
  });
});
