import { create } from 'zustand';

export type RecordingMode = 'auto-stop' | 'always-on';
// Cartesia Ink is the target STT provider — type kept for backwards compat with UI
export type SttProvider = 'cartesia';

// 'system' = auto-paused (8s silence) — reactivates on any user interaction.
// 'user'   = user tapped mic off — sticky until user re-taps.
export type MicPausedReason = 'system' | 'user' | null;
export type MicState = 'active' | 'system-gray' | 'user-off';

const SETTINGS_KEY = 'mvp03_voice_settings';

interface PersistedSettings {
  recordingMode: RecordingMode;
  ttsEnabled: boolean;
  micEnabled: boolean;
}

interface VoiceSettingsState extends PersistedSettings {
  micPausedReason: MicPausedReason;
  recordingModeTransient: boolean;
  loaded: boolean;
  hydrated: boolean;
  sttProvider: SttProvider;
  setRecordingMode: (mode: RecordingMode, options?: { transient?: boolean }) => void;
  setTtsEnabled: (enabled: boolean) => void;
  setMicEnabled: (enabled: boolean) => void;
  systemPauseMic: () => void;
  reactivateIfSystemPaused: () => void;
  setSttProvider: (provider: SttProvider) => void;
  loadSettings: () => void;
  hydrate: (prefs: Partial<PersistedSettings>) => void;
}

const DEFAULTS: PersistedSettings = {
  recordingMode: 'auto-stop',
  ttsEnabled: true,
  micEnabled: true,
};

const VALID_RECORDING_MODES: readonly RecordingMode[] = ['auto-stop', 'always-on'];

export function deriveMicState(s: {
  micEnabled: boolean;
  micPausedReason: MicPausedReason;
}): MicState {
  if (s.micEnabled) return 'active';
  if (s.micPausedReason === 'system') return 'system-gray';
  return 'user-off';
}

function parseStoredSettings(raw: string | null): PersistedSettings {
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw);
    const recordingMode = (VALID_RECORDING_MODES as readonly string[]).includes(parsed.recordingMode)
      ? (parsed.recordingMode as RecordingMode)
      : DEFAULTS.recordingMode;
    return {
      recordingMode,
      ttsEnabled: parsed.ttsEnabled ?? DEFAULTS.ttsEnabled,
      micEnabled: parsed.micEnabled ?? DEFAULTS.micEnabled,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function loadFromStorage(): PersistedSettings {
  try {
    return parseStoredSettings(localStorage.getItem(SETTINGS_KEY));
  } catch {
    return { ...DEFAULTS };
  }
}

function persistFrom(state: PersistedSettings): void {
  try {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        recordingMode: state.recordingMode,
        ttsEnabled: state.ttsEnabled,
        micEnabled: state.micEnabled,
      }),
    );
  } catch {
    // ignore
  }
}

export const useVoiceSettingsStore = create<VoiceSettingsState>((set, get) => ({
  ...DEFAULTS,
  micPausedReason: null,
  recordingModeTransient: false,
  loaded: false,
  hydrated: false,
  sttProvider: 'cartesia' as SttProvider,

  setRecordingMode: (mode, options) => {
    set({ recordingMode: mode, recordingModeTransient: options?.transient === true });
    persistFrom(get());
  },

  setTtsEnabled: (enabled) => {
    set({ ttsEnabled: enabled });
    persistFrom(get());
  },

  setMicEnabled: (enabled) => {
    if (enabled) {
      set({ micEnabled: true, micPausedReason: null });
    } else {
      set({ micEnabled: false, micPausedReason: 'user' });
    }
    persistFrom(get());
  },

  systemPauseMic: () => {
    if (get().micPausedReason === 'user') return;
    set({ micEnabled: false, micPausedReason: 'system' });
    persistFrom(get());
  },

  reactivateIfSystemPaused: () => {
    if (get().micPausedReason !== 'system') return;
    set({ micEnabled: true, micPausedReason: null });
    persistFrom(get());
  },

  setSttProvider: () => {
    // No-op: Cartesia is the only provider
  },

  loadSettings: () => {
    const settings = loadFromStorage();
    set({ ...settings, micPausedReason: null, loaded: true });
  },

  hydrate: (prefs) => {
    const next: Partial<PersistedSettings> = {};
    if (prefs.recordingMode !== undefined) next.recordingMode = prefs.recordingMode;
    if (prefs.ttsEnabled !== undefined) next.ttsEnabled = prefs.ttsEnabled;
    if (prefs.micEnabled !== undefined) next.micEnabled = prefs.micEnabled;
    set({ ...next, hydrated: true });
    persistFrom(get());
  },
}));

// Auto-load on import
if (typeof window !== 'undefined') {
  useVoiceSettingsStore.getState().loadSettings();
}
