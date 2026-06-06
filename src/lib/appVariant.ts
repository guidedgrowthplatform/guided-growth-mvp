import { Capacitor } from '@capacitor/core';

// Runtime check (not build-time) because Android prod/qa flavors share one
// web bundle — only the native applicationId differs.
const QA_APP_ID = 'app.guidedgrowth.staging';

let cached: Promise<boolean> | null = null;

async function resolveQaBuild(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { App } = await import('@capacitor/app');
    const { id } = await App.getInfo();
    return id === QA_APP_ID;
  } catch {
    return false;
  }
}

export function isQaBuild(): Promise<boolean> {
  cached ??= resolveQaBuild();
  return cached;
}
