import { create } from 'zustand';

// RMS thresholds (matched to stt-service.computeRms doc comment):
//   < 0.0008 silence-gate floor
//   ~0.005   clearly audible speech
//   ~0.05    close-talking peak
const SPEECH_RMS_THRESHOLD = 0.005;

interface AudioMetrics {
  currentRms: number;
  vadActive: boolean;
  lastSpeechTimestamp: number | null;
}

interface AudioMetricsState extends AudioMetrics {
  pushChunkRms: (rms: number) => void;
  reset: () => void;
}

const DEFAULTS: AudioMetrics = {
  currentRms: 0,
  vadActive: false,
  lastSpeechTimestamp: null,
};

export const useAudioMetricsStore = create<AudioMetricsState>((set, get) => ({
  ...DEFAULTS,

  pushChunkRms: (rms) => {
    const isSpeech = rms >= SPEECH_RMS_THRESHOLD;
    const prev = get().lastSpeechTimestamp;
    set({
      currentRms: rms,
      vadActive: isSpeech,
      lastSpeechTimestamp: isSpeech ? Date.now() : prev,
    });
  },

  reset: () => {
    set({ ...DEFAULTS });
  },
}));

export const SPEECH_RMS = SPEECH_RMS_THRESHOLD;
