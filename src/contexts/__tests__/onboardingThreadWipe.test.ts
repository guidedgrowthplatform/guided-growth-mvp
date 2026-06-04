import { describe, expect, it } from 'vitest';
import { shouldWipeOnAnonIdChange } from '../onboardingThreadWipe';

describe('shouldWipeOnAnonIdChange', () => {
  it('first resolve (null → id) preserves the hydrated thread', () => {
    expect(shouldWipeOnAnonIdChange(null, 'a')).toBe(false);
  });

  it('same identity re-emit does not wipe', () => {
    expect(shouldWipeOnAnonIdChange('a', 'a')).toBe(false);
  });

  it('genuine user switch wipes (leak prevention)', () => {
    expect(shouldWipeOnAnonIdChange('a', 'b')).toBe(true);
  });

  it('logout (id → null) wipes, clearing the prior user thread', () => {
    expect(shouldWipeOnAnonIdChange('a', null)).toBe(true);
  });
});
