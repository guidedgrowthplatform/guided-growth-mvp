import { Capacitor } from '@capacitor/core';

// iOS can evict WebView localStorage; Preferences (UserDefaults/SharedPreferences) survives.
// Hydrated to a sync cache at boot so render-path reads (AppGate) stay synchronous.

export const FIRST_OPEN = 'gg_first_open';

const KEYS: readonly string[] = [FIRST_OPEN];

const isNative = Capacitor.isNativePlatform();
const cache = new Map<string, string>();

export async function hydratePersistentFlags(): Promise<void> {
  if (!isNative) return;
  try {
    const { Preferences } = await import('@capacitor/preferences');
    await Promise.all(
      KEYS.map(async (key) => {
        const { value } = await Preferences.get({ key });
        if (value !== null) cache.set(key, value);
      }),
    );
  } catch {
    // degrade to unset
  }
}

export function getFlag(key: string): string | null {
  return isNative ? (cache.get(key) ?? null) : localStorage.getItem(key);
}

export function setFlag(key: string, value: string): void {
  if (!isNative) {
    localStorage.setItem(key, value);
    return;
  }
  cache.set(key, value);
  void import('@capacitor/preferences')
    .then(({ Preferences }) => Preferences.set({ key, value }))
    .catch(() => {});
}

export function removeFlag(key: string): void {
  if (!isNative) {
    localStorage.removeItem(key);
    return;
  }
  cache.delete(key);
  void import('@capacitor/preferences')
    .then(({ Preferences }) => Preferences.remove({ key }))
    .catch(() => {});
}
