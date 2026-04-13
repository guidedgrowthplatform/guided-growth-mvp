import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { VoiceContext, modeFromState } from '@/contexts/voiceContextDef';
import type { VoiceState, VoicePreference } from '@/contexts/voiceContextDef';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

// ─── Provider ───────────────────────────────────────────────────────────────

const VOICE_PREF_KEY = 'guided_growth_voice_preference';

function loadLocalPreference(): VoicePreference {
  try {
    const saved = localStorage.getItem(VOICE_PREF_KEY);
    if (saved === 'text_only' || saved === 'speak_in_text_out') return saved;
  } catch {
    /* ignore */
  }
  return 'full_voice';
}

function saveLocalPreference(pref: VoicePreference): void {
  try {
    localStorage.setItem(VOICE_PREF_KEY, pref);
  } catch {
    /* ignore */
  }
}

export function VoiceProvider({ children }: { children: ReactNode }) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [preference, setPreferenceState] = useState<VoicePreference>(loadLocalPreference);
  const cleanupRef = useRef<(() => void) | null>(null);
  const user = useAuthStore((s) => s.user);

  // ── Sync preference from Supabase on login ──────────────────────────────
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const VALID_PREFS: VoicePreference[] = ['full_voice', 'text_only', 'speak_in_text_out'];

    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('voice_mode')
          .eq('id', user.id)
          .single();

        if (cancelled) return;

        const raw = data?.voice_mode;
        const dbPref = VALID_PREFS.includes(raw as VoicePreference)
          ? (raw as VoicePreference)
          : null;

        // DB is authoritative on login — always apply if valid
        if (dbPref) {
          setPreferenceState(dbPref);
          saveLocalPreference(dbPref);
        }
      } catch {
        // DB fetch failed — keep localStorage value
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

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
        console.warn(
          `[VoiceContext] Invalid transition attempt to ${next} from non-realtime state ${current}`,
        );
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

  const setPreference = useCallback(
    (pref: VoicePreference) => {
      setPreferenceState(pref);
      saveLocalPreference(pref);

      // Persist to Supabase profiles.voice_mode (fire-and-forget)
      if (user) {
        supabase
          .from('profiles')
          .update({ voice_mode: pref })
          .eq('id', user.id)
          .then(() => {
            // voice_mode persisted to DB
          });
      }
    },
    [user],
  );

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
