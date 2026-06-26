/**
 * Ghost-fill bus: a tiny module-level pub/sub that carries OPTIMISTIC card fills
 * from the live skimmer to the active beat's adapter, separate from the real
 * LLM voice-action bus.
 *
 * Why a separate channel (not the existing subscribeVoiceActions):
 *  - Zero changes to OnboardingVoiceProvider, so the authoritative voice path is
 *    untouched and the ghost layer can be removed by deleting this file + its
 *    two call sites.
 *  - Ghost results must NOT trigger the adapters' auto-submit/advance. They share
 *    the OnboardingVoiceResult SHAPE (so adapter handlers read params the same
 *    way), but arriving on this channel signals "pre-fill only, do not commit".
 *
 * The real tool result still arrives on the normal voice-action bus and is what
 * actually advances the beat, reconciling or overriding the ghost.
 */
import { useEffect, useRef } from 'react';
import type { OnboardingVoiceResult } from '@/contexts/useOnboardingVoiceSession';

type GhostListener = (result: OnboardingVoiceResult) => void;

const listeners = new Set<GhostListener>();

/** Emit an optimistic fill to whatever active-beat adapter is listening. */
export function publishGhostFill(result: OnboardingVoiceResult): void {
  for (const l of [...listeners]) {
    try {
      l(result);
    } catch {
      // A bad listener must not stop the others or the skimmer.
    }
  }
}

/** Subscribe an adapter to ghost fills. Mirrors useOnboardingVoiceActions. */
export function useGhostFill(handler: GhostListener, enabled: boolean = true): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!enabled) return;
    const l: GhostListener = (r) => handlerRef.current(r);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [enabled]);
}
