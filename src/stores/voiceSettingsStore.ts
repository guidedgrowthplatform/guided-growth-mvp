import { create } from 'zustand';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export type RecordingMode = 'auto-stop' | 'always-on';

const SETTINGS_KEY = 'mvp03_voice_settings';
const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

interface VoiceSettings {
  recordingMode: RecordingMode;
  selectedVoiceName: string | null;
  ttsEnabled: boolean;
}

interface VoiceSettingsState extends VoiceSettings {
  loaded: boolean;
  setRecordingMode: (mode: RecordingMode) => void;
  setSelectedVoiceName: (name: string | null) => void;
  setTtsEnabled: (enabled: boolean) => void;
  loadSettings: () => void;
}

const DEFAULTS: VoiceSettings = {
  recordingMode: 'auto-stop',
  selectedVoiceName: null,
  ttsEnabled: true,
};

const VALID_RECORDING_MODES: readonly RecordingMode[] = ['auto-stop', 'always-on'];

function parseStoredSettings(raw: string | null): VoiceSettings {
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw);
    const recordingMode = (VALID_RECORDING_MODES as readonly string[]).includes(parsed.recordingMode)
      ? (parsed.recordingMode as RecordingMode)
      : DEFAULTS.recordingMode;
    return {
      recordingMode,
      selectedVoiceName: parsed.selectedVoiceName || DEFAULTS.selectedVoiceName,
      ttsEnabled: parsed.ttsEnabled ?? DEFAULTS.ttsEnabled,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

// ─── Storage abstraction: Capacitor Preferences (native) or localStorage (web) ───

function loadFromStorage(): VoiceSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return parseStoredSettings(raw);
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

async function loadFromStorageAsync(): Promise<VoiceSettings> {
  if (isNative) {
    try {
      const { value } = await Preferences.get({ key: SETTINGS_KEY });
      const settings = parseStoredSettings(value);
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
      return settings;
    } catch (err) {
      console.warn('[VoiceSettings] Capacitor Preferences.get failed, falling back to localStorage:', err);
    }
  }
  return loadFromStorage();
}

function saveToStorage(settings: VoiceSettings): void {
  const json = JSON.stringify(settings);
  try { localStorage.setItem(SETTINGS_KEY, json); } catch { /* ignore */ }
  if (isNative) {
    Preferences.set({ key: SETTINGS_KEY, value: json }).catch((err) => {
      console.warn('[VoiceSettings] Capacitor Preferences.set failed:', err);
    });
  }
}

export const useVoiceSettingsStore = create<VoiceSettingsState>((set, get) => ({
  ...DEFAULTS,
  loaded: false,

  setRecordingMode: (mode) => {
    set({ recordingMode: mode });
    const { selectedVoiceName, ttsEnabled } = get();
    saveToStorage({ recordingMode: mode, selectedVoiceName, ttsEnabled });
  },

  setSelectedVoiceName: (name) => {
    set({ selectedVoiceName: name });
    const { recordingMode, ttsEnabled } = get();
    saveToStorage({ recordingMode, selectedVoiceName: name, ttsEnabled });
  },

  setTtsEnabled: (enabled) => {
    set({ ttsEnabled: enabled });
    const { recordingMode, selectedVoiceName } = get();
    saveToStorage({ recordingMode, selectedVoiceName, ttsEnabled: enabled });
  },

  loadSettings: () => {
    const syncSettings = loadFromStorage();
    set({ ...syncSettings, loaded: true });
    if (isNative) {
      loadFromStorageAsync().then((nativeSettings) => {
        set({ ...nativeSettings, loaded: true });
      });
    }
  },
}));

// Auto-load on import
if (typeof window !== 'undefined') {
  useVoiceSettingsStore.getState().loadSettings();
}
