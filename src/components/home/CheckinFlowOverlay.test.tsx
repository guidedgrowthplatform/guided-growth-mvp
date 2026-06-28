import { describe, expect, it } from 'vitest';
import { morningCheckinV1 } from '@/onboarding-flow/flows/checkin-flows';
import { buildCheckinCompleteEvent } from './checkinCompleteEvent';

describe('buildCheckinCompleteEvent', () => {
  it('maps the captured checkin to the legacy CheckInCard property names', () => {
    expect(
      buildCheckinCompleteEvent('morning', { sleep: 4, mood: 3, energy: 5, stress: 2 }, false, 12),
    ).toEqual({
      checkin_type: 'morning',
      sleep_quality: 4,
      mood: 3,
      energy_level: 5,
      stress_level: 2,
      duration_seconds: 12,
      is_update: false,
    });
  });

  it('carries the type + is_update and tolerates a partial check-in', () => {
    const e = buildCheckinCompleteEvent('evening', { mood: 4 }, true, 0);
    expect(e.checkin_type).toBe('evening');
    expect(e.is_update).toBe(true);
    expect(e.sleep_quality).toBeUndefined();
  });
});

describe('morningCheckinV1 shape', () => {
  it('state-check saves via record_checkin', () => {
    const state = morningCheckinV1.nodes.find((n) => n.id === 'morning-state');
    expect(state?.tool?.toolName).toBe('record_checkin');
  });

  // are-you-done requires a tap, so the flow never silently auto-completes
  it('are-you-done requires user input', () => {
    const beat = morningCheckinV1.nodes.find((n) => n.id === 'morning-are-you-done');
    expect(beat?.voice.expectsInput).toBe(true);
  });

  it('wrap is terminal', () => {
    const wrap = morningCheckinV1.nodes.find((n) => n.id === 'morning-wrap');
    expect(wrap?.type === 'beat' ? wrap.nextId : 'not-a-beat').toBeNull();
  });
});
