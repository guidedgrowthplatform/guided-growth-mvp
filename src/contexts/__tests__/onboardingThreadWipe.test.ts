import { describe, expect, it } from 'vitest';
import { shouldWipeOnAnonIdChange, shouldWipeOnColdStart } from '../onboardingThreadWipe';

describe('shouldWipeOnColdStart', () => {
  it('flag OFF wipes (byte-identical to legacy)', () => {
    expect(shouldWipeOnColdStart(false)).toBe(true);
  });

  it('flag ON preserves the continuous thread across the Vapi round-trip', () => {
    expect(shouldWipeOnColdStart(true)).toBe(false);
  });
});

describe('shouldWipeOnAnonIdChange', () => {
  it('flag OFF wipes on first resolve (null → id)', () => {
    expect(shouldWipeOnAnonIdChange(false, null, 'a')).toBe(true);
  });

  it('flag OFF wipes on same identity re-emit', () => {
    expect(shouldWipeOnAnonIdChange(false, 'a', 'a')).toBe(true);
  });

  it('flag OFF wipes on user switch', () => {
    expect(shouldWipeOnAnonIdChange(false, 'a', 'b')).toBe(true);
  });

  it('flag ON: first resolve (null → id) preserves the hydrated thread', () => {
    expect(shouldWipeOnAnonIdChange(true, null, 'a')).toBe(false);
  });

  it('flag ON: same identity re-emit does not wipe', () => {
    expect(shouldWipeOnAnonIdChange(true, 'a', 'a')).toBe(false);
  });

  it('flag ON: genuine user switch wipes (leak prevention preserved)', () => {
    expect(shouldWipeOnAnonIdChange(true, 'a', 'b')).toBe(true);
  });

  it('flag ON: id → null (logout) wipes, clearing the prior user thread', () => {
    expect(shouldWipeOnAnonIdChange(true, 'a', null)).toBe(true);
  });
});
