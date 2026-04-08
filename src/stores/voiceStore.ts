import { create } from 'zustand';

interface VoiceState {
  isListening: boolean;
  isPreparing: boolean;
  transcript: string;
  correctedTranscript: string;
  interim: string;
  error: string;
  isSupported: boolean;
  startPreparing: () => void;
  startListening: () => void;
  stopListening: () => void;
  appendTranscript: (text: string) => void;
  setTranscript: (text: string) => void;
  setCorrectedTranscript: (text: string) => void;
  setInterim: (text: string) => void;
  setError: (error: string) => void;
  resetTranscript: () => void;
  setSupported: (supported: boolean) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isListening: false,
  isPreparing: false,
  transcript: '',
  correctedTranscript: '',
  interim: '',
  error: '',
  isSupported: true,
  // Preparing = mic tap registered, getUserMedia + AudioContext setting up,
  // audio not yet flowing. Components should show a spinner / pulse and
  // disable the mic button to prevent double-taps during this window.
  startPreparing: () => set({ isPreparing: true, error: '', interim: '' }),
  // Listening = audio chunks are actively being captured. Safe to tell
  // the user to start speaking.
  startListening: () => set({ isPreparing: false, isListening: true, error: '', interim: '' }),
  stopListening: () => set({ isPreparing: false, isListening: false, interim: '' }),
  appendTranscript: (text: string) =>
    set((state) => ({
      transcript: state.transcript ? `${state.transcript} ${text}` : text,
      interim: '',
    })),
  setTranscript: (text: string) => set({ transcript: text }),
  setCorrectedTranscript: (text: string) => set({ correctedTranscript: text }),
  setInterim: (text: string) => set({ interim: text }),
  setError: (error: string) => set({ error }),
  resetTranscript: () => set({ transcript: '', correctedTranscript: '', error: '', interim: '' }),
  setSupported: (supported: boolean) => set({ isSupported: supported }),
}));
