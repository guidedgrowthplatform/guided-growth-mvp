import { create } from 'zustand';

export type RecordingMode = 'auto-stop' | 'always-on';

const SETTINGS_KEY = 'mvp03_voice_settings';

interface VoiceSettings {
  recordingMode: RecordingMode;
  selectedVoiceName: string | null;
}

interface VoiceSettingsState extends VoiceSettings {
  loaded: boolean;
  setRecordingMode: (mode: RecordingMode) => void;
  setSelectedVoiceName: (name: string | null) => void;
  loadSettings: () => void;
}

function loadFromStorage(): VoiceSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { recordingMode: 'auto-stop', selectedVoiceName: null };
}

function saveToStorage(settings: VoiceSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

export const useVoiceSettingsStore = create<VoiceSettingsState>((set, get) => ({
  recordingMode: 'auto-stop',
  selectedVoiceName: null,
  loaded: false,

  setRecordingMode: (mode) => {
    set({ recordingMode: mode });
    const { selectedVoiceName } = get();
    saveToStorage({ recordingMode: mode, selectedVoiceName });
  },

  setSelectedVoiceName: (name) => {
    set({ selectedVoiceName: name });
    const { recordingMode } = get();
    saveToStorage({ recordingMode, selectedVoiceName: name });
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
