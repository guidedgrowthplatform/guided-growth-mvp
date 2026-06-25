import { describe, expect, it } from 'vitest';
import { localHour } from '@gg/shared/time/bucketTimeOfDay';
import { resolveCheckinWindow } from '../useCheckinEntry';

describe('resolveCheckinWindow — morning until 4 PM, evening from 5 PM', () => {
  it('treats 05:00–15:59 as the morning window', () => {
    for (const hour of [5, 6, 11, 12, 14, 15]) {
      expect(resolveCheckinWindow(hour)).toEqual({
        isMorning: true,
        isEvening: false,
        proactiveWindow: true,
      });
    }
  });

  it('treats late-night (before 05:00) as evening, not morning (#207)', () => {
    for (const hour of [0, 2, 4]) {
      expect(resolveCheckinWindow(hour)).toEqual({
        isMorning: false,
        isEvening: true,
        proactiveWindow: true,
      });
    }
  });

  it('stops offering morning at exactly 16:00 (4 PM)', () => {
    expect(resolveCheckinWindow(16)).toEqual({
      isMorning: false,
      isEvening: false,
      proactiveWindow: false,
    });
  });

  it('leaves 16:00-16:59 as a no-proactive buffer', () => {
    expect(resolveCheckinWindow(16).proactiveWindow).toBe(false);
  });

  it('starts the evening window at exactly 17:00 (5 PM)', () => {
    for (const hour of [17, 20, 21, 23]) {
      expect(resolveCheckinWindow(hour)).toEqual({
        isMorning: false,
        isEvening: true,
        proactiveWindow: true,
      });
    }
  });
});

describe('localHour → resolveCheckinWindow (Intl tz extraction, #207)', () => {
  const instant = new Date('2026-06-25T07:00:00Z');

  it('07:00Z resolves to evening in America/New_York (03:00 local)', () => {
    const h = localHour(instant, 'America/New_York');
    expect(h).toBe(3);
    expect(resolveCheckinWindow(h).isEvening).toBe(true);
  });

  it('07:00Z resolves to the buffer in Asia/Tokyo (16:00 local)', () => {
    const h = localHour(instant, 'Asia/Tokyo');
    expect(h).toBe(16);
    expect(resolveCheckinWindow(h).proactiveWindow).toBe(false);
  });

  it('07:00Z resolves to morning in Europe/London (08:00 local)', () => {
    const h = localHour(instant, 'Europe/London');
    expect(h).toBe(8);
    expect(resolveCheckinWindow(h).isMorning).toBe(true);
  });
});
