import { Capacitor } from '@capacitor/core';

// Runtime check (not build-time) because Android prod/qa flavors share one
// web bundle — only the native applicationId differs.
const QA_APP_ID = 'app.guidedgrowth.staging';
const STABLE_SCHEME = 'guidedgrowth';
const QA_SCHEME = 'guidedgrowthqa';

// Single source of truth for the OAuth deep-link scheme. Must match the exact
// id that native registers (iOS plist / Android qa flavor) so they never diverge.
export function schemeForAppId(appId: string): string {
  return appId === QA_APP_ID ? QA_SCHEME : STABLE_SCHEME;
}

let cachedId: Promise<string | null> | null = null;

async function resolveAppId(): Promise<string | null> {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    const { App } = await import('@capacitor/app');
    return (await App.getInfo()).id;
  } catch {
    cachedId = null; // don't cache a transient getInfo() failure
    return null;
  }
}

function appId(): Promise<string | null> {
  cachedId ??= resolveAppId();
  return cachedId;
}

export async function isQaBuild(): Promise<boolean> {
  return (await appId()) === QA_APP_ID;
}

export async function authScheme(): Promise<string> {
  return schemeForAppId((await appId()) ?? '');
}
