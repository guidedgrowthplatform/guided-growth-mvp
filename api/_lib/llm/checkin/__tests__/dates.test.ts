import { afterEach, describe, expect, it, vi } from 'vitest';

const { todayStr, parseDateParam } = await import('../handlers/shared.js');

afterEach(() => vi.useRealTimers());

function freeze(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

describe('todayStr', () => {
  it('returns the server-UTC day for UTC', () => {
    freeze('2026-06-02T04:30:00Z');
    expect(todayStr('UTC')).toBe('2026-06-02');
  });

  it('returns the prior day west of UTC after local midnight rollover (the core bug)', () => {
    // 04:30 UTC is still 2026-06-01 21:30 in Los Angeles.
    freeze('2026-06-02T04:30:00Z');
    expect(todayStr('America/Los_Angeles')).toBe('2026-06-01');
  });

  it('keeps the same local day earlier in the evening', () => {
    freeze('2026-06-01T23:30:00Z'); // 16:30 local LA
    expect(todayStr('America/Los_Angeles')).toBe('2026-06-01');
  });

  it('advances the day east of UTC', () => {
    freeze('2026-06-01T20:00:00Z'); // 03:00 next day in Jakarta (UTC+7)
    expect(todayStr('Asia/Jakarta')).toBe('2026-06-02');
  });

  it('defaults to UTC when no tz is passed', () => {
    freeze('2026-06-02T04:30:00Z');
    expect(todayStr()).toBe('2026-06-02');
  });
});

describe('parseDateParam', () => {
  it('"today"/empty resolve to the tz-local day', () => {
    freeze('2026-06-02T04:30:00Z');
    expect(parseDateParam('today', 'America/Los_Angeles')).toBe('2026-06-01');
    expect(parseDateParam(undefined, 'America/Los_Angeles')).toBe('2026-06-01');
  });

  it('"yesterday" subtracts a day from the tz-local day', () => {
    freeze('2026-06-02T04:30:00Z'); // LA local today = 2026-06-01
    expect(parseDateParam('yesterday', 'America/Los_Angeles')).toBe('2026-05-31');
  });

  it('resolves a weekday to the most recent matching day (incl. today)', () => {
    freeze('2026-06-10T12:00:00Z');
    const d = parseDateParam('monday', 'UTC');
    const [y, m, dd] = d.split('-').map(Number);
    expect(new Date(Date.UTC(y, m - 1, dd)).getUTCDay()).toBe(1); // Monday
    expect(d <= todayStr('UTC')).toBe(true);
  });

  it('passes a valid YYYY-MM-DD through unchanged', () => {
    freeze('2026-06-10T12:00:00Z');
    expect(parseDateParam('2026-05-15', 'UTC')).toBe('2026-05-15');
  });

  it('returns null for malformed/unrecognized date strings', () => {
    freeze('2026-06-10T12:00:00Z');
    expect(parseDateParam('2026-13-99', 'UTC')).toBeNull();
    expect(parseDateParam('next tuesday', 'UTC')).toBeNull();
  });
});
