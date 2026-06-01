import { create } from 'zustand';

// Cartesia Ink is the STT provider — type kept for backwards compat with UI
export type SttProvider = 'cartesia';

// 'system' = auto-paused (8s silence / recording limit) — reactivates on any
// user interaction (global listener in App.tsx).
export type MicPausedReason = 'system' | null;

interface VoiceSettingsState {
  micPausedReason: MicPausedReason;
  sttProvider: SttProvider;
  systemPauseMic: () => void;
  reactivateIfSystemPaused: () => void;
  setSttProvider: (provider: SttProvider) => void;
}

// Persistent voice/mic toggles live in user_preferences (see voiceGate.ts).
// This store now holds only runtime-transient mic state.
export const useVoiceSettingsStore = create<VoiceSettingsState>((set, get) => ({
  micPausedReason: null,
  sttProvider: 'cartesia',

  systemPauseMic: () => {
    set({ micPausedReason: 'system' });
  },

  reactivateIfSystemPaused: () => {
    if (get().micPausedReason !== 'system') return;
    set({ micPausedReason: null });
  },

  setSttProvider: () => {
    // No-op: Cartesia is the only provider
  },
}));
