import { describe, it, expect } from 'vitest';
import { formatDate, getMonthDays, getWeekDays, isWeekend, isWeekday, getWeekRange } from './dates';

describe('formatDate', () => {
  it('formats a Date object', () => {
    expect(formatDate(new Date(2025, 0, 15))).toBe('2025-01-15');
  });

  it('formats a date string', () => {
    expect(formatDate('2025-06-01')).toBe('2025-06-01');
  });

  it('uses custom format', () => {
    expect(formatDate('2025-06-01', 'MMMM yyyy')).toBe('June 2025');
  });
});

describe('getMonthDays', () => {
  it('returns all days of the month', () => {
    const days = getMonthDays('2025-01-15');
    expect(days).toHaveLength(31);
    expect(days[0].getDate()).toBe(1);
    expect(days[30].getDate()).toBe(31);
  });

  it('handles February', () => {
    const days = getMonthDays('2025-02-10');
    expect(days).toHaveLength(28);
  });

  it('handles leap year February', () => {
    const days = getMonthDays('2024-02-10');
    expect(days).toHaveLength(29);
  });
});

describe('getWeekDays', () => {
  it('returns 7 days starting Monday', () => {
    const days = getWeekDays('2025-01-15'); // Wednesday
    expect(days).toHaveLength(7);
    expect(days[0].getDay()).toBe(1); // Monday
    expect(days[6].getDay()).toBe(0); // Sunday
  });
});

describe('isWeekend / isWeekday', () => {
  it('Saturday is weekend', () => {
    expect(isWeekend(new Date(2025, 0, 18))).toBe(true); // Saturday
    expect(isWeekday(new Date(2025, 0, 18))).toBe(false);
  });

  it('Monday is weekday', () => {
    expect(isWeekend(new Date(2025, 0, 13))).toBe(false); // Monday
    expect(isWeekday(new Date(2025, 0, 13))).toBe(true);
  });
});

describe('getWeekRange', () => {
  it('returns Monday-Sunday range', () => {
    const { start, end } = getWeekRange('2025-01-15'); // Wednesday
    expect(start.getDay()).toBe(1); // Monday
    expect(end.getDay()).toBe(0); // Sunday
    expect(start.getDate()).toBe(13);
    expect(end.getDate()).toBe(19);
  });
});
