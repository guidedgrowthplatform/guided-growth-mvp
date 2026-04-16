import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { VoiceContext, modeFromState } from '@/contexts/voiceContextDef';
import type { VoiceState, VoicePreference } from '@/contexts/voiceContextDef';
import { supabase } from '@/lib/supabase';

// ─── Provider ───────────────────────────────────────────────────────────────

const VOICE_PREF_KEY = 'guided_growth_voice_preference';

function normalizePreference(raw: string | null | undefined): VoicePreference {
  // Accept new canonical values and migrate legacy ones for backwards compat.
  if (raw === 'voice' || raw === 'screen' || raw === 'always_ask') return raw;
  if (raw === 'full_voice') return 'voice';
  if (raw === 'text_only' || raw === 'speak_in_text_out') return 'screen';
  return 'voice';
}

function loadPreference(): VoicePreference {
  try {
    return normalizePreference(localStorage.getItem(VOICE_PREF_KEY));
  } catch {
    return 'voice';
  }
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [preference, setPreferenceState] = useState<VoicePreference>(loadPreference);
  const [micPermission, setMicPermission] = useState(true);

  // Sync preference + mic_permission from Supabase on mount.
  // ai_output_mode (voice/screen) lives in user_preferences.voice_mode
  // mic_permission (true/false) lives in profiles.mic_permission
  // These are INDEPENDENT per Yair spec — 4 valid combinations.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return;
      // Sync ai_output_mode
      supabase
        .from('user_preferences')
        .select('voice_mode')
        .eq('user_id', data.user.id)
        .maybeSingle()
        .then(({ data: pref }) => {
          if (!pref?.voice_mode) return;
          const normalized = normalizePreference(String(pref.voice_mode));
          setPreferenceState(normalized);
          try {
            localStorage.setItem(VOICE_PREF_KEY, normalized);
          } catch {
            /* */
          }
        })
        .then(null, () => {});
      // Sync mic_permission
      supabase
        .from('profiles')
        .select('mic_permission')
        .eq('id', data.user.id)
        .maybeSingle()
        .then(({ data: profile }) => {
          if (profile && profile.mic_permission === false) {
            setMicPermission(false);
          }
        })
        .then(null, () => {});
    });
  }, []);
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
      /* */
    }
    // Persist to Supabase (fire-and-forget)
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return;
      supabase
        .from('user_preferences')
        .upsert({ user_id: data.user.id, voice_mode: pref }, { onConflict: 'user_id' })
        .then(null, () => {});
    });
  }, []);

  const value = useMemo(
    () => ({
      voiceState,
      mode,
      preference,
      micPermission,
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
      micPermission,
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
