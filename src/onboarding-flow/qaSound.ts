/**
 * qaSound — tiny global store for the QA sound mute toggle.
 *
 * Backed by localStorage (key: gg_qa_sound_muted) so the toggle survives
 * page reloads without any server round-trip. Intentionally outside React
 * state so any module (hooks, plain TS) can read isQaMuted() synchronously.
 *
 * Only active in QA / dev builds: callers are responsible for the guard.
 */

const STORAGE_KEY = 'gg_qa_sound_muted';

// ─── Subscribers ────────────────────────────────────────────────────────────

type Listener = () => void;
const listeners = new Set<Listener>();

// ─── Read ────────────────────────────────────────────────────────────────────

/** Returns true when QA audio is currently muted. */
export function isQaMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

// ─── Write ───────────────────────────────────────────────────────────────────

/** Set the muted state and notify all subscribers. */
export function setQaMuted(value: boolean): void {
  try {
    if (value) {
      localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage blocked (private mode etc.). State will still propagate in-memory
    // via the subscribe mechanism for the lifetime of the page.
  }
  listeners.forEach((fn) => fn());
}

// ─── Subscribe ───────────────────────────────────────────────────────────────

/**
 * Subscribe to mute-state changes. Returns an unsubscribe function.
 *
 * Compatible with React 18 useSyncExternalStore:
 *   useSyncExternalStore(subscribe, isQaMuted)
 */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ─── React hook ──────────────────────────────────────────────────────────────

import { useSyncExternalStore } from 'react';

/** Hook returning the current muted state, re-renders on toggle. */
export function useQaMuted(): boolean {
  return useSyncExternalStore(subscribe, isQaMuted);
}
