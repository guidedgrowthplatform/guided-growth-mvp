import { describe, expect, it } from 'vitest';
import { type CheckinEntry, resolveCoachOpen } from '../useCheckinEntry';

const entry = (over: Partial<CheckinEntry>): CheckinEntry => ({
  isMorning: true,
  type: 'morning',
  checkinScreenId: 'MCHECK-01',
  doneToday: false,
  ...over,
});

describe('resolveCoachOpen', () => {
  it('leads the morning check-in when not done', () => {
    expect(
      resolveCoachOpen(entry({ isMorning: true, type: 'morning', checkinScreenId: 'MCHECK-01' })),
    ).toEqual({ screenId: 'MCHECK-01', initiateCheckin: true });
  });

  it('leads the evening check-in when not done', () => {
    expect(
      resolveCoachOpen(entry({ isMorning: false, type: 'evening', checkinScreenId: 'ECHECK-01' })),
    ).toEqual({ screenId: 'ECHECK-01', initiateCheckin: true });
  });

  it('opens plain chat when the morning check-in is already done', () => {
    expect(resolveCoachOpen(entry({ checkinScreenId: 'MCHECK-01', doneToday: true }))).toEqual({
      screenId: 'HOME-CHECKIN',
      initiateCheckin: false,
    });
  });

  it('opens plain chat when the evening check-in is already done', () => {
    expect(
      resolveCoachOpen(
        entry({ isMorning: false, type: 'evening', checkinScreenId: 'ECHECK-01', doneToday: true }),
      ),
    ).toEqual({ screenId: 'HOME-CHECKIN', initiateCheckin: false });
  });
});
