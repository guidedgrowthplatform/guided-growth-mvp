import { useSyncExternalStore } from 'react';

// Shared "has the flow been started" flag for the annotated render. The
// Get Started beat and the Coach Greeting beat are separate stacked tiles, so
// they talk through this tiny module store instead of prop threading. The coach
// greeting MP3 stays silent until Get Started is pressed, so the page no longer
// plays audio the moment it loads.

let started = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function startFlow() {
  if (started) return;
  started = true;
  emit();
}

export function resetStartGate() {
  if (!started) return;
  started = false;
  emit();
}

export function useHasStarted() {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => started,
    () => started,
  );
}
