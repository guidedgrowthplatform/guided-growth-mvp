/**
 * Polyfill for window.localStorage / window.sessionStorage in Vitest tests.
 *
 * jsdom 25+ rewrote Web Storage to be file-backed and ships an empty stub
 * (no `clear`, `setItem`, etc.) when no storage file is provided. That
 * breaks every test that exercises stores or services backed by
 * localStorage. We replace the broken stub with an in-memory polyfill.
 *
 * Wired up via `test.setupFiles` in vite.config.ts.
 */

function createInMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
  };
}

function ensureStorage(name: 'localStorage' | 'sessionStorage'): void {
  const existing = (globalThis as unknown as Record<string, Storage | undefined>)[name];
  if (existing && typeof existing.clear === 'function') return;

  Object.defineProperty(globalThis, name, {
    value: createInMemoryStorage(),
    writable: true,
    configurable: true,
  });
}

ensureStorage('localStorage');
ensureStorage('sessionStorage');
