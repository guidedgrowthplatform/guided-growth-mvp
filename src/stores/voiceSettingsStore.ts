import { create } from 'zustand';

export type RecordingMode = 'auto-stop' | 'always-on';
// Cartesia Ink is the target STT provider — type kept for backwards compat with UI
export type SttProvider = 'cartesia';

const SETTINGS_KEY = 'mvp03_voice_settings';

interface VoiceSettings {
  recordingMode: RecordingMode;
  selectedVoiceName: string | null;
  ttsEnabled: boolean;
  micEnabled: boolean;
}

interface VoiceSettingsState extends VoiceSettings {
  loaded: boolean;
  sttProvider: SttProvider;
  setRecordingMode: (mode: RecordingMode) => void;
  setSelectedVoiceName: (name: string | null) => void;
  setTtsEnabled: (enabled: boolean) => void;
  setMicEnabled: (enabled: boolean) => void;
  setSttProvider: (provider: SttProvider) => void;
  loadSettings: () => void;
}

const DEFAULTS: VoiceSettings = {
  recordingMode: 'auto-stop',
  selectedVoiceName: null,
  ttsEnabled: true,
  micEnabled: true,
};

const VALID_RECORDING_MODES: readonly RecordingMode[] = ['auto-stop', 'always-on'];

function parseStoredSettings(raw: string | null): VoiceSettings {
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw);
    const recordingMode = (VALID_RECORDING_MODES as readonly string[]).includes(
      parsed.recordingMode,
    )
      ? (parsed.recordingMode as RecordingMode)
      : DEFAULTS.recordingMode;
    return {
      recordingMode,
      selectedVoiceName: parsed.selectedVoiceName || DEFAULTS.selectedVoiceName,
      ttsEnabled: parsed.ttsEnabled ?? DEFAULTS.ttsEnabled,
      micEnabled: parsed.micEnabled ?? DEFAULTS.micEnabled,
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

export const useVoiceSettingsStore = create<VoiceSettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,
  sttProvider: 'cartesia' as SttProvider,

  setRecordingMode: (mode) => {
    set({ recordingMode: mode });
    const { selectedVoiceName, ttsEnabled, micEnabled } = get();
    saveToStorage({ recordingMode: mode, selectedVoiceName, ttsEnabled, micEnabled });
  },

  setSelectedVoiceName: (name) => {
    set({ selectedVoiceName: name });
    const { recordingMode, ttsEnabled, micEnabled } = get();
    saveToStorage({ recordingMode, selectedVoiceName: name, ttsEnabled, micEnabled });
  },

  setTtsEnabled: (enabled) => {
    set({ ttsEnabled: enabled });
    const { recordingMode, selectedVoiceName, micEnabled } = get();
    saveToStorage({ recordingMode, selectedVoiceName, ttsEnabled: enabled, micEnabled });
  },

  setMicEnabled: (enabled) => {
    set({ micEnabled: enabled });
    const { recordingMode, selectedVoiceName, ttsEnabled } = get();
    saveToStorage({ recordingMode, selectedVoiceName, ttsEnabled, micEnabled: enabled });
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
