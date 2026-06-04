// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getOrCreateOnboardingChatSessionId,
  clearOnboardingChatSessionId,
} from '../onboardingChatSession';

describe('onboardingChatSession', () => {
  beforeEach(() => {
    clearOnboardingChatSessionId();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('getOrCreateOnboardingChatSessionId', () => {
    it('mints once and reuses the same id', () => {
      const first = getOrCreateOnboardingChatSessionId();
      const second = getOrCreateOnboardingChatSessionId();

      expect(typeof first).toBe('string');
      expect(first.length).toBeGreaterThan(0);
      expect(second).toBe(first);
    });

    it('returns a different id after clear', () => {
      const first = getOrCreateOnboardingChatSessionId();
      clearOnboardingChatSessionId();
      const second = getOrCreateOnboardingChatSessionId();

      expect(second).not.toBe(first);
      expect(second.length).toBeGreaterThan(0);
    });

    it('falls back to a stable in-memory id when sessionStorage throws', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('storage disabled');
      });

      const first = getOrCreateOnboardingChatSessionId();
      const second = getOrCreateOnboardingChatSessionId();

      expect(typeof first).toBe('string');
      expect(first.length).toBeGreaterThan(0);
      expect(second).toBe(first);

      spy.mockRestore();
    });
  });
});
