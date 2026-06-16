import { describe, expect, it } from 'vitest';
import { isEveningDoneToday } from '@/hooks/useCheckinDoneToday';
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

describe('isEveningDoneToday', () => {
  const now = new Date('2026-06-17T20:00:00Z');

  it('true when an evening checkin_completed lands on the local day', () => {
    expect(isEveningDoneToday([evt({ timestamp: '2026-06-17T19:00:00Z' })], now)).toBe(true);
  });

  it('false when the evening event is from yesterday', () => {
    expect(isEveningDoneToday([evt({ timestamp: '2026-06-16T19:00:00Z' })], now)).toBe(false);
  });

  it('false when only a morning checkin_completed exists today', () => {
    expect(
      isEveningDoneToday(
        [evt({ timestamp: '2026-06-17T08:00:00Z', payload: { type: 'morning' } })],
        now,
      ),
    ).toBe(false);
  });

  it('false on an empty log', () => {
    expect(isEveningDoneToday([], now)).toBe(false);
  });
});
