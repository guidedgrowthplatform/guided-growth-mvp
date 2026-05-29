import { describe, expect, it } from 'vitest';
import { rmsToIntensity } from '../useMicRingIntensity';

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
