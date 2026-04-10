import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { VoiceContext } from '@/contexts/voiceContextDef';
import type { VoiceMode, VoicePreference } from '@/contexts/voiceContextDef';

// ─── Provider ───────────────────────────────────────────────────────────────

const VOICE_PREF_KEY = 'guided_growth_voice_preference';

function loadPreference(): VoicePreference {
  try {
    const saved = localStorage.getItem(VOICE_PREF_KEY);
    if (saved === 'text_only' || saved === 'speak_in_text_out') return saved;
  } catch {
    /* ignore */
  }
  return 'full_voice';
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<VoiceMode>('idle');
  const [preference, setPreferenceState] = useState<VoicePreference>(loadPreference);
  const cleanupRef = useRef<(() => void) | null>(null);

  /** Run any registered cleanup for the current mode */
  const runCleanup = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
  }, []);

  const stopAll = useCallback(() => {
    runCleanup();
    setMode('idle');
  }, [runCleanup]);

  const enterMp3 = useCallback((): boolean => {
    if (mode === 'mp3') return true;
    if (mode === 'realtime') {
      runCleanup();
    }
    setMode('mp3');
    return true;
  }, [mode, runCleanup]);

  const enterRealtime = useCallback((): boolean => {
    if (mode === 'realtime') return true;
    if (mode === 'mp3') {
      runCleanup();
    }
    setMode('realtime');
    return true;
  }, [mode, runCleanup]);

  const release = useCallback(() => {
    runCleanup();
    setMode('idle');
  }, [runCleanup]);

  const registerCleanup = useCallback((fn: () => void) => {
    cleanupRef.current = fn;
  }, []);

  const setPreference = useCallback((pref: VoicePreference) => {
    setPreferenceState(pref);
    try {
      localStorage.setItem(VOICE_PREF_KEY, pref);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      mode,
      preference,
      enterMp3,
      enterRealtime,
      release,
      stopAll,
      setPreference,
      registerCleanup,
    }),
    [mode, preference, enterMp3, enterRealtime, release, stopAll, setPreference, registerCleanup],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
