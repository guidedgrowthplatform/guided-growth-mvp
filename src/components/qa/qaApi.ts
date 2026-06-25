import { Capacitor } from '@capacitor/core';

// Same convention as src/api/client.ts: same-origin on web, VITE_API_URL on native.
export function qaApiBase(): string {
  if (Capacitor.isNativePlatform()) {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    console.error('[QA] VITE_API_URL is not set on native — QA endpoints will fail');
  }
  return '';
}

export const QA_TEST_USERS = [
  { name: 'Mintesnot', email: 'qa-mintesnot@guidedgrowth.test' },
  { name: 'Yonas', email: 'qa-yonas@guidedgrowth.test' },
  { name: 'Yair', email: 'qa-yair@guidedgrowth.test' },
  { name: 'Timothy', email: 'qa-timothy@guidedgrowth.test' },
  { name: 'Alejandro', email: 'qa-alejandro@guidedgrowth.test' },
] as const;
