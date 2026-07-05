import { describe, expect, it } from 'vitest';
import { recommendedWeeklyDay } from '../weeklyDay';

describe('recommendedWeeklyDay', () => {
  it('recommends Saturday night (6) for Israel (Sunday-start work week)', () => {
    expect(recommendedWeeklyDay('Asia/Jerusalem')).toBe(6);
  });

  it('recommends Sunday night (0) for Monday-start regions', () => {
    expect(recommendedWeeklyDay('America/New_York')).toBe(0);
    expect(recommendedWeeklyDay('Europe/London')).toBe(0);
    expect(recommendedWeeklyDay('America/Bogota')).toBe(0);
    expect(recommendedWeeklyDay('Asia/Tokyo')).toBe(0);
  });

  it('defaults unknown zones to Sunday night (0)', () => {
    expect(recommendedWeeklyDay('Not/AZone')).toBe(0);
  });
});
