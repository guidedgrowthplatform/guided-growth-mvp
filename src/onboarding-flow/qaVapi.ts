/**
 * qaVapi - small localStorage-backed toggle for QA Vapi testing.
 *
 * The voice config reads this once at module load. Callers reload after writes
 * so OnboardingVoiceProvider gets a fresh engine decision.
 */

const STORAGE_KEY = 'gg_vapi_enabled';

type Listener = () => void;
const listeners = new Set<Listener>();

export function isQaVapiEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setQaVapiEnabled(value: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, value ? 'true' : 'false');
  } catch {
    // Storage blocked. The write cannot persist, but listeners still update
    // until the page reloads.
  }
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

import { useSyncExternalStore } from 'react';

export function useQaVapiEnabled(): boolean {
  return useSyncExternalStore(subscribe, isQaVapiEnabled);
}
