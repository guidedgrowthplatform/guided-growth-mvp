import { Capacitor } from '@capacitor/core';

const PROD_WEB_ORIGIN_FALLBACK = 'https://guided-growth-mvp.vercel.app';

let warnedMissingEnv = false;

export function getWebOrigin(): string {
  const fromEnv = import.meta.env.VITE_PUBLIC_WEB_ORIGIN as string | undefined;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  if (!Capacitor.isNativePlatform()) return window.location.origin;
  if (import.meta.env.DEV && !warnedMissingEnv) {
    warnedMissingEnv = true;
    console.warn(
      '[env] VITE_PUBLIC_WEB_ORIGIN unset on native — falling back to prod URL. Set it in .env.local for dev builds.',
    );
  }
  return PROD_WEB_ORIGIN_FALLBACK;
}
