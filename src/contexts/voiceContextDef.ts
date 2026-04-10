import { createContext } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

/** The three voice modes — only one can be active at a time */
export type VoiceMode = 'idle' | 'mp3' | 'realtime';

/** User preference for how voice works across the app */
export type VoicePreference = 'full_voice' | 'text_only' | 'speak_in_text_out';

export interface VoiceContextValue {
  /** Current active voice mode */
  mode: VoiceMode;

  /** User's voice preference setting */
  preference: VoicePreference;

  /** Request to enter mp3 mode — stops any active realtime session first */
  enterMp3: () => boolean;

  /** Request to enter realtime mode — stops any active MP3 first */
  enterRealtime: () => boolean;

  /** Release the voice channel back to idle */
  release: () => void;

  /** Stop whatever is currently playing/streaming and go idle */
  stopAll: () => void;

  /** Set user's voice preference */
  setPreference: (pref: VoicePreference) => void;

  /** Register a cleanup function for the current mode's resources */
  registerCleanup: (fn: () => void) => void;
}

export const VoiceContext = createContext<VoiceContextValue | null>(null);
