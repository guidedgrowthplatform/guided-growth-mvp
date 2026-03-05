import { create } from 'zustand';

export type RecordingMode = 'auto-stop' | 'always-on';
export type SttProvider = 'webspeech' | 'whisper' | 'deepgram';

const SETTINGS_KEY = 'mvp03_voice_settings';

interface VoiceSettings {
  recordingMode: RecordingMode;
  selectedVoiceName: string | null;
  ttsEnabled: boolean;
  sttProvider: SttProvider;
}

interface VoiceSettingsState extends VoiceSettings {
  loaded: boolean;
  setRecordingMode: (mode: RecordingMode) => void;
  setSelectedVoiceName: (name: string | null) => void;
  setTtsEnabled: (enabled: boolean) => void;
  setSttProvider: (provider: SttProvider) => void;
  loadSettings: () => void;
}

function loadFromStorage(): VoiceSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        recordingMode: parsed.recordingMode || 'auto-stop',
        selectedVoiceName: parsed.selectedVoiceName || null,
        ttsEnabled: parsed.ttsEnabled ?? true,
        sttProvider: parsed.sttProvider || 'webspeech',
      };
    }
  } catch { /* ignore */ }
  return { recordingMode: 'auto-stop', selectedVoiceName: null, ttsEnabled: true, sttProvider: 'webspeech' };
}

function saveToStorage(settings: VoiceSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

export const useVoiceSettingsStore = create<VoiceSettingsState>((set, get) => ({
  recordingMode: 'auto-stop',
  selectedVoiceName: null,
  ttsEnabled: true,
  sttProvider: 'webspeech',
  loaded: false,

  setRecordingMode: (mode) => {
    set({ recordingMode: mode });
    const { selectedVoiceName, ttsEnabled, sttProvider } = get();
    saveToStorage({ recordingMode: mode, selectedVoiceName, ttsEnabled, sttProvider });
  },

  setSelectedVoiceName: (name) => {
    set({ selectedVoiceName: name });
    const { recordingMode, ttsEnabled, sttProvider } = get();
    saveToStorage({ recordingMode, selectedVoiceName: name, ttsEnabled, sttProvider });
  },

  setTtsEnabled: (enabled) => {
    set({ ttsEnabled: enabled });
    const { recordingMode, selectedVoiceName, sttProvider } = get();
    saveToStorage({ recordingMode, selectedVoiceName, ttsEnabled: enabled, sttProvider });
  },

  setSttProvider: (provider) => {
    set({ sttProvider: provider });
    const { recordingMode, selectedVoiceName, ttsEnabled } = get();
    saveToStorage({ recordingMode, selectedVoiceName, ttsEnabled, sttProvider: provider });
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
