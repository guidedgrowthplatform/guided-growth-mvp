import { describe, expect, it } from 'vitest';
import type { SessionLogEvent } from '@/stores/sessionLogStore';
import { resolveReminderCoachOpen } from '../useReminderCheckinDeepLink';

function event(
  event_type: string,
  type: 'morning' | 'evening',
  timestamp = new Date().toISOString(),
): SessionLogEvent {
  return { event_type, payload: { type }, timestamp } as unknown as SessionLogEvent;
}

describe('resolveReminderCoachOpen', () => {
  it('fresh morning → MCHECK-01, initiate', () => {
    expect(resolveReminderCoachOpen('morning', [])).toEqual({
      screenId: 'MCHECK-01',
      initiateCheckin: true,
    });
  });

  it('fresh evening → ECHECK-01, initiate', () => {
    expect(resolveReminderCoachOpen('evening', [])).toEqual({
      screenId: 'ECHECK-01',
      initiateCheckin: true,
    });
  });

  it('done today → HOME-CHECKIN, no initiate', () => {
    const events = [event('checkin_completed', 'morning')];
    expect(resolveReminderCoachOpen('morning', events)).toEqual({
      screenId: 'HOME-CHECKIN',
      initiateCheckin: false,
    });
  });

  it('started but not done → dedicated screen, no opener', () => {
    const events = [event('checkin_started', 'evening')];
    expect(resolveReminderCoachOpen('evening', events)).toEqual({
      screenId: 'ECHECK-01',
      initiateCheckin: false,
    });
  });

  it("other bucket's events don't affect this bucket", () => {
    const events = [event('checkin_completed', 'evening')];
    expect(resolveReminderCoachOpen('morning', events)).toEqual({
      screenId: 'MCHECK-01',
      initiateCheckin: true,
    });
  });

  it('yesterday’s completion is ignored → still fresh', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const events = [event('checkin_completed', 'morning', yesterday)];
    expect(resolveReminderCoachOpen('morning', events)).toEqual({
      screenId: 'MCHECK-01',
      initiateCheckin: true,
    });
  });
});
