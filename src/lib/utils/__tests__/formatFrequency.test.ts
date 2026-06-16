import { describe, it, expect } from 'vitest';
import { formatFrequency } from '../formatFrequency';

describe('formatFrequency', () => {
  it('maps known tokens to friendly labels', () => {
    expect(formatFrequency('daily')).toBe('Daily');
    expect(formatFrequency('weekdays')).toBe('Weekdays');
    expect(formatFrequency('weekends')).toBe('Weekends');
    expect(formatFrequency('weekly')).toBe('Weekly');
    expect(formatFrequency('once_a_week')).toBe('Weekly');
    expect(formatFrequency('once_in_week')).toBe('Weekly');
    expect(formatFrequency('3_specific_days')).toBe('3x / week');
  });

  it('normalizes Nx/week variants', () => {
    expect(formatFrequency('3x/week')).toBe('3x / week');
    expect(formatFrequency('5x / week')).toBe('5x / week');
  });

  it('title-cases unknown snake_case as a fallback', () => {
    expect(formatFrequency('every_other_day')).toBe('Every Other Day');
  });

  it('returns empty string for empty input', () => {
    expect(formatFrequency('')).toBe('');
  });
});
