import { describe, expect, it } from 'vitest';
import { rmsToIntensity, stepSpeechGate, type SpeechGate } from '../useMicRingIntensity';

describe('rmsToIntensity', () => {
  it('clamps silence/sub-floor to 0', () => {
    expect(rmsToIntensity(0)).toBe(0);
    expect(rmsToIntensity(0.005)).toBe(0);
    expect(rmsToIntensity(0.001)).toBe(0);
  });
  it('clamps close-talk and above to 1', () => {
    expect(rmsToIntensity(0.05)).toBe(1);
    expect(rmsToIntensity(0.2)).toBe(1);
  });
  it('maps mid-range linearly', () => {
    // midpoint between floor (0.005) and ceil (0.05)
    expect(rmsToIntensity(0.0275)).toBeCloseTo(0.5, 5);
  });
});

describe('stepSpeechGate', () => {
  const OFF: SpeechGate = { speaking: false, belowSince: 0 };

  it('stays closed below the open threshold', () => {
    expect(stepSpeechGate(OFF, 0.1, 1000)).toEqual({ speaking: false, belowSince: 0 });
  });

  it('opens at/above SPEECH_OPEN (0.15)', () => {
    expect(stepSpeechGate(OFF, 0.15, 1000)).toEqual({ speaking: true, belowSince: 0 });
  });

  it('holds open between CLOSE and OPEN (hysteresis)', () => {
    const on: SpeechGate = { speaking: true, belowSince: 0 };
    expect(stepSpeechGate(on, 0.1, 1000)).toEqual({ speaking: true, belowSince: 0 });
  });

  it('arms the release timer on first dip below CLOSE, stays open', () => {
    const on: SpeechGate = { speaking: true, belowSince: 0 };
    expect(stepSpeechGate(on, 0.02, 1000)).toEqual({ speaking: true, belowSince: 1000 });
  });

  it('closes only after the release hold elapses', () => {
    const armed: SpeechGate = { speaking: true, belowSince: 1000 };
    expect(stepSpeechGate(armed, 0.02, 1500).speaking).toBe(true); // 500ms < 600
    expect(stepSpeechGate(armed, 0.02, 1600)).toEqual({ speaking: false, belowSince: 0 }); // 600ms
  });

  it('cancels the release timer if level recovers above CLOSE', () => {
    const armed: SpeechGate = { speaking: true, belowSince: 1000 };
    expect(stepSpeechGate(armed, 0.1, 1500)).toEqual({ speaking: true, belowSince: 0 });
  });
});
