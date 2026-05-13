import { createContext } from 'react';

export interface SessionLogContextValue {
  sessionId: string;
  logEvent: <E extends string>(
    event_type: E,
    payload?: Record<string, unknown>,
    screen_id?: string,
  ) => void;
  // Voice session anchors: pair voice_started/voice_ended with a shared
  // voice_anchor_id so analytics can pair them even when multiple voice
  // sessions overlap (e.g. BottomNav TTS toggle + useRealtimeVoice).
  // Persisted to sessionStorage so tab-close mid-session emits a
  // tab_close_recovery voice_ended on next mount.
  startVoice: (screen_id?: string, extra?: Record<string, unknown>) => string;
  endVoice: (anchor_id: string, reason: string, extra?: Record<string, unknown>) => void;
}

export const SessionLogContext = createContext<SessionLogContextValue | null>(null);
