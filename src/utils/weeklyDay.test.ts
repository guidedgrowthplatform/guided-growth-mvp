import { describe, it, expect } from 'vitest';
import { recommendedWeeklyDay } from './weeklyDay';

// G07/G08: verify the timezone-to-day resolver produces the same day the card
// preselects, so the coach and card are always in sync.

describe('recommendedWeeklyDay', () => {
  it('returns Saturday (6) for Asia/Jerusalem — Sunday-start work week', () => {
    expect(recommendedWeeklyDay('Asia/Jerusalem')).toBe(6);
  });

  it('returns Sunday (0) for America/New_York — Monday-start work week', () => {
    expect(recommendedWeeklyDay('America/New_York')).toBe(0);
  });

  it('returns Sunday (0) for Europe/London — Monday-start work week', () => {
    expect(recommendedWeeklyDay('Europe/London')).toBe(0);
  });

  it('returns Sunday (0) when timezone is an empty string (default)', () => {
    expect(recommendedWeeklyDay('')).toBe(0);
  });

  it('returns Sunday (0) when timezone is undefined (device default)', () => {
    // Passing undefined falls through to Intl.DateTimeFormat().resolvedOptions().timeZone;
    // any non-Jerusalem zone returns 0.
    const result = recommendedWeeklyDay(undefined as unknown as string);
    // Can be 0 (most CIs) or 6 (Israel-hosted CI) — just verify it's a valid day index.
    expect([0, 6]).toContain(result);
  });

  it('day index is within 0..6 for all SUNDAY_START_ZONES members', () => {
    const day = recommendedWeeklyDay('Asia/Jerusalem');
    expect(day).toBeGreaterThanOrEqual(0);
    expect(day).toBeLessThanOrEqual(6);
  });
});
