import { create } from 'zustand';

interface VoiceState {
    isListening: boolean;
    transcript: string;
    error: string;
    isSupported: boolean;
    startListening: () => void;
    stopListening: () => void;
    appendTranscript: (text: string) => void;
    setError: (error: string) => void;
    resetTranscript: () => void;
    setSupported: (supported: boolean) => void;
}

export const useVoiceStore = create<VoiceState>((set) => ({
    isListening: false,
    transcript: '',
    error: '',
    isSupported: false,
    startListening: () => set({ isListening: true, error: '' }),
    stopListening: () => set({ isListening: false }),
    appendTranscript: (text: string) =>
        set((state) => ({
            transcript: state.transcript ? `${state.transcript} ${text}` : text,
        })),
    setError: (error: string) => set({ error }),
    resetTranscript: () => set({ transcript: '', error: '' }),
    setSupported: (supported: boolean) => set({ isSupported: supported }),
}));
