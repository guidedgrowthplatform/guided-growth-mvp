import { beforeEach, describe, expect, it, vi } from 'vitest';

function mockPreferences(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    store,
    Preferences: {
      get: async ({ key }: { key: string }) => ({ value: store.get(key) ?? null }),
      set: async ({ key, value }: { key: string; value: string }) => {
        store.set(key, value);
      },
      remove: async ({ key }: { key: string }) => {
        store.delete(key);
      },
    },
  };
}

describe('persistentFlags', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  describe('web (localStorage)', () => {
    beforeEach(() => {
      vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
    });

    it('get/set/remove delegate to localStorage', async () => {
      const { FIRST_OPEN, getFlag, setFlag, removeFlag } = await import('../persistentFlags');
      expect(getFlag(FIRST_OPEN)).toBeNull();
      setFlag(FIRST_OPEN, 'true');
      expect(getFlag(FIRST_OPEN)).toBe('true');
      expect(localStorage.getItem(FIRST_OPEN)).toBe('true');
      removeFlag(FIRST_OPEN);
      expect(getFlag(FIRST_OPEN)).toBeNull();
    });

    it('hydrate is a no-op', async () => {
      const { hydratePersistentFlags } = await import('../persistentFlags');
      await expect(hydratePersistentFlags()).resolves.toBeUndefined();
    });
  });

  describe('native (Capacitor Preferences)', () => {
    it('hydrate loads a persisted value into the sync cache', async () => {
      const { Preferences } = mockPreferences({ gg_first_open: 'true' });
      vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
      vi.doMock('@capacitor/preferences', () => ({ Preferences }));

      const { FIRST_OPEN, getFlag, hydratePersistentFlags } = await import('../persistentFlags');
      expect(getFlag(FIRST_OPEN)).toBeNull();
      await hydratePersistentFlags();
      expect(getFlag(FIRST_OPEN)).toBe('true');
    });

    it('setFlag updates the cache synchronously and persists to Preferences', async () => {
      const { store, Preferences } = mockPreferences();
      vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
      vi.doMock('@capacitor/preferences', () => ({ Preferences }));

      const { FIRST_OPEN, getFlag, setFlag } = await import('../persistentFlags');
      setFlag(FIRST_OPEN, 'true');
      expect(getFlag(FIRST_OPEN)).toBe('true');
      await vi.waitFor(() => expect(store.get('gg_first_open')).toBe('true'));
    });

    it('native get does not read localStorage', async () => {
      vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
      vi.doMock('@capacitor/preferences', () => ({ Preferences: mockPreferences().Preferences }));

      localStorage.setItem('gg_first_open', 'true');
      const { FIRST_OPEN, getFlag } = await import('../persistentFlags');
      expect(getFlag(FIRST_OPEN)).toBeNull();
    });
  });
});
