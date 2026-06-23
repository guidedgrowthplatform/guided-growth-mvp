import { useSyncExternalStore } from 'react';
import { isQaBuild } from '@/lib/appVariant';

// QA-vs-prod surface gate. Build flag is the primary signal (Preview scope +
// qa-release native build); native app id is async defense-in-depth.
const FLAG_QA = import.meta.env.VITE_IS_QA_SURFACE === 'true';

let qaState = FLAG_QA;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

// Sync, fail-closed: false until proven QA.
export function isQaEnvironment(): boolean {
  return qaState;
}

// Resolve the async native check once; upgrade state if it confirms QA.
export async function initQaEnv(): Promise<void> {
  if (qaState) return;
  try {
    if (await isQaBuild()) {
      qaState = true;
      emit();
    }
  } catch {
    // fail-closed
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useIsQaEnvironment(): boolean {
  return useSyncExternalStore(subscribe, isQaEnvironment, isQaEnvironment);
}
