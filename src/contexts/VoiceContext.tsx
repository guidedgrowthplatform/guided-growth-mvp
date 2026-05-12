import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { VoiceContext, modeFromState } from '@/contexts/voiceContextDef';
import type { VoiceState } from '@/contexts/voiceContextDef';

// ─── Provider ───────────────────────────────────────────────────────────────

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const cleanupRef = useRef<(() => void) | null>(null);

  /** Run any registered cleanup for the current owner */
  const runCleanup = useCallback(() => {
    const fn = cleanupRef.current;
    cleanupRef.current = null;
    fn?.();
  }, []);

  const stopAll = useCallback(() => {
    runCleanup();
    setVoiceState('idle');
  }, [runCleanup]);

  // Derive mode on the fly
  const mode = modeFromState(voiceState);

  const enterMp3 = useCallback((): boolean => {
    if (voiceState === 'mp3') return true;
    if (mode === 'realtime') {
      runCleanup();
    }
    setVoiceState('mp3');
    return true;
  }, [voiceState, mode, runCleanup]);

  const enterRealtime = useCallback((): boolean => {
    if (mode === 'realtime') return true;
    if (mode === 'mp3') {
      runCleanup();
    }
    setVoiceState('listening'); // Realtime always starts listening
    return true;
  }, [mode, runCleanup]);

  const release = useCallback(() => {
    runCleanup();
    setVoiceState('idle');
  }, [runCleanup]);

  const transition = useCallback((next: VoiceState) => {
    setVoiceState((current: VoiceState) => {
      const currentMode = modeFromState(current);

      if (currentMode !== 'realtime' && next !== 'idle') {
        return current;
      }

      if (
        currentMode === 'realtime' &&
        (next === 'listening' || next === 'thinking' || next === 'speaking' || next === 'idle')
      ) {
        return next;
      }

      return current;
    });
  }, []);

  const registerCleanup = useCallback((fn: () => void) => {
    cleanupRef.current = fn;
  }, []);

  const value = useMemo(
    () => ({
      voiceState,
      mode,
      enterMp3,
      enterRealtime,
      release,
      stopAll,
      transition,
      registerCleanup,
    }),
    [voiceState, mode, enterMp3, enterRealtime, release, stopAll, transition, registerCleanup],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
