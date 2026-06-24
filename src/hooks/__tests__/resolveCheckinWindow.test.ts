import { describe, expect, it } from 'vitest';
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
