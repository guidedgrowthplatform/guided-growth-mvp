import { describe, expect, it } from 'vitest';
import { isCheckinDoneToday } from '@/hooks/useCheckinDoneToday';
import type { SessionLogEvent } from '@/stores/sessionLogStore';

function evt(partial: Partial<SessionLogEvent>): SessionLogEvent {
  return {
    id: 'id',
    session_id: 's',
    timestamp: new Date().toISOString(),
    event_type: 'checkin_completed',
    screen_id: 'ECHECK-01',
    payload: { type: 'evening' },
    sync_status: 'synced',
    ...partial,
  };
}

describe('isCheckinDoneToday', () => {
  const now = new Date('2026-06-17T20:00:00Z');

  it('true when a matching-bucket checkin_completed lands on the local day', () => {
    expect(isCheckinDoneToday([evt({ timestamp: '2026-06-17T19:00:00Z' })], 'evening', now)).toBe(
      true,
    );
  });

  it('false when the event is from yesterday', () => {
    expect(isCheckinDoneToday([evt({ timestamp: '2026-06-16T19:00:00Z' })], 'evening', now)).toBe(
      false,
    );
  });

  it('discriminates buckets: an evening event does NOT mark morning done (MR#2)', () => {
    const events = [evt({ timestamp: '2026-06-17T18:00:00Z', payload: { type: 'evening' } })];
    expect(isCheckinDoneToday(events, 'evening', now)).toBe(true);
    expect(isCheckinDoneToday(events, 'morning', now)).toBe(false);
  });

  it('a morning event marks morning done but not evening', () => {
    const events = [
      evt({
        timestamp: '2026-06-17T08:00:00Z',
        screen_id: 'MCHECK-01',
        payload: { type: 'morning' },
      }),
    ];
    expect(isCheckinDoneToday(events, 'morning', now)).toBe(true);
    expect(isCheckinDoneToday(events, 'evening', now)).toBe(false);
  });

  it('false on an empty log', () => {
    expect(isCheckinDoneToday([], 'morning', now)).toBe(false);
  });
});
