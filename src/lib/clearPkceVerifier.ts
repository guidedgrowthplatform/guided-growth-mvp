import { Capacitor } from '@capacitor/core';

export async function clearPkceVerifier() {
  const pattern = /-auth-token-code-verifier$/;
  if (Capacitor.isNativePlatform()) {
    const { Preferences } = await import('@capacitor/preferences');
    const { keys } = await Preferences.keys();
    await Promise.all(
      keys.filter((k) => pattern.test(k)).map((key) => Preferences.remove({ key })),
    );
  } else {
    const keys = Object.keys(localStorage).filter((k) => pattern.test(k));
    for (const k of keys) localStorage.removeItem(k);
  }
}
