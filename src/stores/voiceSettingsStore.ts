import { create } from 'zustand';

export type RecordingMode = 'auto-stop' | 'always-on';
// Cartesia Ink is the target STT provider — type kept for backwards compat with UI
export type SttProvider = 'cartesia';

// 'system' = auto-paused (8s silence) — reactivates on any user interaction.
// 'user'   = user tapped mic off — sticky until user re-taps.
export type MicPausedReason = 'system' | 'user' | null;
export type MicState = 'active' | 'system-gray' | 'user-off';

const SETTINGS_KEY = 'mvp03_voice_settings';

interface VoiceSettings {
  recordingMode: RecordingMode;
  selectedVoiceName: string | null;
  ttsEnabled: boolean;
  micEnabled: boolean;
  micPausedReason: MicPausedReason;
}

interface VoiceSettingsState extends VoiceSettings {
  loaded: boolean;
  sttProvider: SttProvider;
  setRecordingMode: (mode: RecordingMode) => void;
  setSelectedVoiceName: (name: string | null) => void;
  setTtsEnabled: (enabled: boolean) => void;
  setMicEnabled: (enabled: boolean) => void;
  systemPauseMic: () => void;
  reactivateIfSystemPaused: () => void;
  setSttProvider: (provider: SttProvider) => void;
  loadSettings: () => void;
}

const DEFAULTS: VoiceSettings = {
  recordingMode: 'auto-stop',
  selectedVoiceName: null,
  ttsEnabled: true,
  micEnabled: true,
  micPausedReason: null,
};

const VALID_RECORDING_MODES: readonly RecordingMode[] = ['auto-stop', 'always-on'];
const VALID_PAUSE_REASONS: readonly (string | null)[] = ['system', 'user', null];

export function deriveMicState(s: {
  micEnabled: boolean;
  micPausedReason: MicPausedReason;
}): MicState {
  if (s.micEnabled) return 'active';
  if (s.micPausedReason === 'system') return 'system-gray';
  return 'user-off';
}

function parseStoredSettings(raw: string | null): VoiceSettings {
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw);
    const recordingMode = (VALID_RECORDING_MODES as readonly string[]).includes(
      parsed.recordingMode,
    )
      ? (parsed.recordingMode as RecordingMode)
      : DEFAULTS.recordingMode;
    const micPausedReason = VALID_PAUSE_REASONS.includes(parsed.micPausedReason)
      ? (parsed.micPausedReason as MicPausedReason)
      : DEFAULTS.micPausedReason;
    return {
      recordingMode,
      selectedVoiceName: parsed.selectedVoiceName || DEFAULTS.selectedVoiceName,
      ttsEnabled: parsed.ttsEnabled ?? DEFAULTS.ttsEnabled,
      micEnabled: parsed.micEnabled ?? DEFAULTS.micEnabled,
      micPausedReason,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function loadFromStorage(): VoiceSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return parseStoredSettings(raw);
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

function saveToStorage(settings: VoiceSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    /* ignore */
  }
}

function persistFrom(state: VoiceSettings): void {
  saveToStorage({
    recordingMode: state.recordingMode,
    selectedVoiceName: state.selectedVoiceName,
    ttsEnabled: state.ttsEnabled,
    micEnabled: state.micEnabled,
    micPausedReason: state.micPausedReason,
  });
}

export const useVoiceSettingsStore = create<VoiceSettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  sttProvider: 'cartesia' as SttProvider,

  setRecordingMode: (mode) => {
    set({ recordingMode: mode });
    persistFrom(get());
  },

  setSelectedVoiceName: (name) => {
    set({ selectedVoiceName: name });
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
    set({ ...settings, loaded: true });
  },
}));

// Auto-load on import
if (typeof window !== 'undefined') {
  useVoiceSettingsStore.getState().loadSettings();
}
