import { useCallback, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { VoiceContext, modeFromState } from '@/contexts/voiceContextDef';
import type { VoiceState, VoicePreference } from '@/contexts/voiceContextDef';

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

// TODO: Wire to Supabase profiles.voice_mode after migration is applied
// to production. See supabase/migrations/009_voice_profile_columns.sql

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [preference, setPreferenceState] = useState<VoicePreference>(loadPreference);
  const cleanupRef = useRef<(() => void) | null>(null);

  /** Run any registered cleanup for the current owner */
  const runCleanup = useCallback(() => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
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
      voiceState,
      mode,
      preference,
      enterMp3,
      enterRealtime,
      release,
      stopAll,
      transition,
      setPreference,
      registerCleanup,
    }),
    [
      voiceState,
      mode,
      preference,
      enterMp3,
      enterRealtime,
      release,
      stopAll,
      transition,
      setPreference,
      registerCleanup,
    ],
  );

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
