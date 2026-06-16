import { Capacitor } from '@capacitor/core';
import { KeepAwake } from '@capacitor-community/keep-awake';

// #208: keep the screen on during active voice sessions. Native uses the plugin
// (FLAG_KEEP_SCREEN_ON / iOS idle-timer); web uses the Screen Wake Lock API.

let webSentinel: WakeLockSentinel | null = null;
let active = false;

async function acquireWeb(): Promise<void> {
  if (!('wakeLock' in navigator)) return;
  if (webSentinel) return;
  try {
    webSentinel = await navigator.wakeLock.request('screen');
    // Sentinel auto-releases on tab hide; drop our ref so reacquire works.
    webSentinel.addEventListener('release', () => {
      webSentinel = null;
    });
  } catch {
    webSentinel = null;
  }
}

async function releaseWeb(): Promise<void> {
  if (!webSentinel) return;
  try {
    await webSentinel.release();
  } catch {
    /* sentinel may already be released */
  } finally {
    webSentinel = null;
  }
}

export async function acquireWakeLock(): Promise<void> {
  active = true;
  try {
    if (Capacitor.isNativePlatform()) {
      await KeepAwake.keepAwake();
    } else {
      await acquireWeb();
    }
  } catch {
    /* never break the voice session over a failed lock */
  }
}

export async function releaseWakeLock(): Promise<void> {
  active = false;
  try {
    if (Capacitor.isNativePlatform()) {
      await KeepAwake.allowSleep();
    } else {
      await releaseWeb();
    }
  } catch {
    /* idempotent */
  }
}

// Web sentinel auto-releases on tab hide; re-call on return-to-visible if still active.
export async function reacquireIfActive(): Promise<void> {
  if (!active) return;
  await acquireWakeLock();
}

// Background-release for battery without clearing the active intent, so
// reacquireIfActive() restores the lock on return-to-visible.
export async function suspendWakeLock(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) {
      await KeepAwake.allowSleep();
    } else {
      await releaseWeb();
    }
  } catch {
    /* idempotent */
  }
}
