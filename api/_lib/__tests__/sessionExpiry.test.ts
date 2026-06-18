import { describe, expect, it } from 'vitest';
import { isSessionExpiredEligible } from '../sessionExpiry.js';

const WINDOW = 14 * 24 * 60 * 60 * 1000;
const now = new Date('2026-06-18T00:00:00.000Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

describe('isSessionExpiredEligible', () => {
  it('lapsed + never notified → eligible', () => {
    expect(
      isSessionExpiredEligible({ lastSeenAt: daysAgo(15), notifiedAt: null }, now, WINDOW),
    ).toBe(true);
  });

  it('not yet lapsed → not eligible', () => {
    expect(
      isSessionExpiredEligible({ lastSeenAt: daysAgo(10), notifiedAt: null }, now, WINDOW),
    ).toBe(false);
  });

  it('already notified since last active → not eligible', () => {
    expect(
      isSessionExpiredEligible({ lastSeenAt: daysAgo(20), notifiedAt: daysAgo(15) }, now, WINDOW),
    ).toBe(false);
  });

  it('returned then lapsed again (notified before last active) → eligible', () => {
    expect(
      isSessionExpiredEligible({ lastSeenAt: daysAgo(15), notifiedAt: daysAgo(40) }, now, WINDOW),
    ).toBe(true);
  });
});
