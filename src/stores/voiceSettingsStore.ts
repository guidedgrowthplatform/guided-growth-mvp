import { create } from 'zustand';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

export type RecordingMode = 'auto-stop' | 'always-on';
export type SttProvider = 'webspeech' | 'whisper' | 'deepgram' | 'elevenlabs';

const SETTINGS_KEY = 'mvp03_voice_settings';
const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform();

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

const DEFAULTS: VoiceSettings = {
  recordingMode: 'auto-stop',
  selectedVoiceName: null,
  ttsEnabled: true,
  sttProvider: 'webspeech',
};

const VALID_RECORDING_MODES: readonly RecordingMode[] = ['auto-stop', 'always-on'];
const VALID_STT_PROVIDERS: readonly SttProvider[] = ['webspeech', 'whisper', 'deepgram', 'elevenlabs'];

function parseStoredSettings(raw: string | null): VoiceSettings {
  if (!raw) return { ...DEFAULTS };
  try {
    const parsed = JSON.parse(raw);
    const recordingMode = (VALID_RECORDING_MODES as readonly string[]).includes(parsed.recordingMode)
      ? (parsed.recordingMode as RecordingMode)
      : DEFAULTS.recordingMode;
    const sttProvider = (VALID_STT_PROVIDERS as readonly string[]).includes(parsed.sttProvider)
      ? (parsed.sttProvider as SttProvider)
      : DEFAULTS.sttProvider;
    return {
      recordingMode,
      selectedVoiceName: parsed.selectedVoiceName || DEFAULTS.selectedVoiceName,
      ttsEnabled: parsed.ttsEnabled ?? DEFAULTS.ttsEnabled,
      sttProvider,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

// ─── Storage abstraction: Capacitor Preferences (native) or localStorage (web) ───

function loadFromStorage(): VoiceSettings {
  // Synchronous load from localStorage (always available as initial state)
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return parseStoredSettings(raw);
  } catch { /* ignore */ }
  return { ...DEFAULTS };
}

async function loadFromStorageAsync(): Promise<VoiceSettings> {
  if (isNative) {
    // On native (iOS/Android), use Capacitor Preferences (persists via UserDefaults/SharedPrefs)
    try {
      const { value } = await Preferences.get({ key: SETTINGS_KEY });
      const settings = parseStoredSettings(value);
      // Sync to localStorage for fast subsequent loads
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

  // Always save to localStorage (fast, synchronous)
  try {
    localStorage.setItem(SETTINGS_KEY, json);
  } catch { /* ignore */ }

  // On native, also persist to Capacitor Preferences (survives app restart on iOS)
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
    // Immediate sync load from localStorage (prevents flash of default state)
    const syncSettings = loadFromStorage();
    set({ ...syncSettings, loaded: true });

    // Then async load from Capacitor Preferences (authoritative on native)
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
