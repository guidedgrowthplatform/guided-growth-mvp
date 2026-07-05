/**
 * Vapi daily-cap accounting.
 *
 * Release-prep guard (2026-07-05): the cap default is 5 (gg-spec UX-12), and
 * onboarding voice is cap-exempt so it never consumes the daily allowance.
 */
import { describe, expect, it } from 'vitest';
import { VAPI_DAILY_CAP, countVapiToday, type CapCountableEvent } from '../voice';

const NOW = new Date('2026-07-05T12:00:00.000Z');

function started(overrides: Partial<CapCountableEvent> = {}): CapCountableEvent {
  return {
    event_type: 'voice_started',
    timestamp: '2026-07-05T09:00:00.000Z',
    payload: { voice_vendor: 'vapi' },
    ...overrides,
  };
}

describe('VAPI_DAILY_CAP', () => {
  it('defaults to 5 (reverted from the 25 test override)', () => {
    expect(VAPI_DAILY_CAP).toBe(5);
  });
});

describe('countVapiToday', () => {
  it('counts today\'s non-exempt Vapi voice_started events', () => {
    const events = [started(), started(), started()];
    expect(countVapiToday(events, NOW)).toBe(3);
  });

  it('does NOT count cap-exempt (onboarding) starts', () => {
    const events = [
      started({ payload: { voice_vendor: 'vapi', cap_exempt: true } }),
      started({ payload: { voice_vendor: 'vapi', cap_exempt: true } }),
      started(), // one non-exempt
    ];
    expect(countVapiToday(events, NOW)).toBe(1);
  });

  it('a full onboarding of exempt starts keeps the count at zero', () => {
    const events = Array.from({ length: 12 }, () =>
      started({ payload: { voice_vendor: 'vapi', cap_exempt: true } }),
    );
    expect(countVapiToday(events, NOW)).toBe(0);
  });

  it('ignores non-Vapi vendors', () => {
    const events = [started({ payload: { voice_vendor: 'cartesia' } })];
    expect(countVapiToday(events, NOW)).toBe(0);
  });

  it('ignores non-voice_started events', () => {
    const events = [started({ event_type: 'screen_entered' })];
    expect(countVapiToday(events, NOW)).toBe(0);
  });

  it('ignores events from other calendar days', () => {
    const events = [started({ timestamp: '2026-07-04T09:00:00.000Z' })];
    expect(countVapiToday(events, NOW)).toBe(0);
  });
});
