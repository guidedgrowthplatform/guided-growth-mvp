import { describe, it, expect } from 'vitest';
import { parseHabitsFromText } from '../parse-habits-from-text';

describe('parseHabitsFromText', () => {
  it('splits a comma + "and" brain dump into separate habits', () => {
    const habits = parseHabitsFromText(
      'I want to drink more water, meditate every morning, read before bed, and gym Monday Wednesday Friday',
    );
    expect(habits.length).toBeGreaterThanOrEqual(3);
    expect(habits.some((h) => h.name.toLowerCase().includes('water'))).toBe(true);
    expect(habits.some((h) => h.name.toLowerCase().includes('meditate'))).toBe(true);
    expect(habits.some((h) => h.name.toLowerCase().includes('read'))).toBe(true);
  });

  it('still parses habits through filler words', () => {
    const habits = parseHabitsFromText(
      'um I want to like drink more water and also maybe read books before bed and uh go to the gym',
    );
    expect(habits.length).toBeGreaterThanOrEqual(2);
  });

  it('strips a leading "I want to" from the habit name', () => {
    const [habit] = parseHabitsFromText('I want to drink more water');
    expect(habit.name.toLowerCase()).not.toMatch(/^i\s+want\s+to/);
    expect(habit.name.toLowerCase()).toContain('water');
  });

  it('resolves frequency hints', () => {
    expect(parseHabitsFromText('meditate every day')[0].frequency).toBe('daily');
    expect(parseHabitsFromText('gym 3 times a week')[0].frequency).toBe('3x/week');
    expect(parseHabitsFromText('run on Monday')[0].frequency).toBe('3_specific_days');
  });

  it('returns an empty array for empty or non-string input', () => {
    expect(parseHabitsFromText('')).toEqual([]);
    expect(parseHabitsFromText(undefined as unknown as string)).toEqual([]);
  });
});
