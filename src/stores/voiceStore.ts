import { create } from 'zustand';

interface VoiceState {
  isListening: boolean;
  transcript: string;
  interim: string;
  error: string;
  isSupported: boolean;
  startListening: () => void;
  stopListening: () => void;
  appendTranscript: (text: string) => void;
  setTranscript: (text: string) => void;
  setInterim: (text: string) => void;
  setError: (error: string) => void;
  resetTranscript: () => void;
  setSupported: (supported: boolean) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
  isListening: false,
  transcript: '',
  interim: '',
  error: '',
  isSupported: false,
  startListening: () => set({ isListening: true, error: '', interim: '' }),
  stopListening: () => set({ isListening: false, interim: '' }),
  appendTranscript: (text: string) =>
    set((state) => ({
      transcript: state.transcript ? `${state.transcript} ${text}` : text,
      interim: '',
    })),
  setTranscript: (text: string) => set({ transcript: text }),
  setInterim: (text: string) => set({ interim: text }),
  setError: (error: string) => set({ error }),
  resetTranscript: () => set({ transcript: '', error: '', interim: '' }),
  setSupported: (supported: boolean) => set({ isSupported: supported }),
}));
